// Most of this code is extremely ugly because it's performance tuned. Apologies.

/** Queries */

const ROOT = "d"; // Variable name of the first argument in compiled functions
const ANDAND = "&&"; // compile perf

function isObject(o) {
    return o && o.constructor === Object;
}

function serialize(value) {
    if (value instanceof Date) {
        return '' + value.getTime();
    }
    return JSON.stringify(value);
}

function op(operator) {
    return (name, value) => {
        if (value instanceof Array) {
            // strict match array contents
            // Must be in the same order, so we can do a simple generator here
            return `(_=${name},(${compileArrayMatches(value, "_", operator)}))`
        }

        if (compile.queryArrays) {
            // Support comparisons with Dates. If the value is a date, we try to call the target value's .getTime.
            // If it isn't, we just do a direct comparison with getTime (Unix timestamp in ms). So the target value
            // may also be a unix timestamp (in ms).
            // If the field is an array, we must check if one of the elements matches the given condition. This is slow (.some), but it works.
            // It's not too bad on small arrays.
            return `(_=${name},__=${serialize(value)},(typeof _==="object"&&_!==null?((_ instanceof Array)?(_.some(function(v){return v${operator}__})):(((_ instanceof Date)?_.getTime():_)${operator}__)):_${operator}__))`;
        } else {
            return name + operator + serialize(value);
        }
    }
}

function op$in(operator) {
    return function (name, value) {
        const length = value.length;
        let res = "";
        let at = -1;

        while (++at < length) {
            const match = value[at];
            const code = match instanceof RegExp ? `(${match.toString()}).test(${name})` : `(_=${name},_&&_.indexOf&&_.indexOf(${serialize(match)})!==-1)`;
            res += `${at ? operator : ""}${code}`;
        }
        
        return res;
    }
}

const $eq = op("===");
const transforms = {
    // Comparison
    $gt: op('>'),
    $lt: op('<'),
    $gte: op('>='),
    $lte: op('<='),
    $eq: (name, value) => {
        if (value instanceof RegExp) {
            return `(${value.toString()}).test(${name})`;
        } else if (value instanceof Array) {
            // strict match array contents
            // Must be in the same order, so we can do a simple generator here
            return `(_=${name},(${compileArrayMatches(value, "_", "===")}))`
        }

        if (compile.queryArrays) {
            // If field is an array, check if it contains the given value.
            return `(_=${name},__=${serialize(value)},(_ instanceof Array)?_.indexOf(__)!==-1:((_ instanceof Date)?_.getTime():_)===__)`;
        } else {
            return name + "===" + serialize(value);
        }
    },
    $ne: (name, value) => `!(${transforms.eq(name, value)})`,
    $in: op$in("||"),
    $nin: (name, value) => `!(${transforms.$in(name, value)})`,
    // Logical
    // Element
    $exists: (name, value) => `${name}${value ? "!" : "="}==void 0`,
    // $regex: custom
    // Evaluation
    $mod: (name, value) => `${name}%${serialize(value[0])}===${serialize(value[1])}`, // [divisor, remainder]
    $type: (name, value) => {
        if (value === null) return `${name}===null`;
        if (value === Array || value instanceof Array) return `${name} instanceof Array`;

        let type = typeof value;
        if (value === String) type = "string";
        else if (value === Number) type = "number";
        else if (value === Object) type = "object";
        else if (value === Boolean) type = "boolean";
        else if (value === Date) return `${name} instanceof Date`;
        return `typeof ${name} === "${type}"`;
    },
    // Array
    $all: (name, value) => op$in("&&"),
    $size: (name, value) => `(_=${name},_&&_.length===${serialize(value)})`,
    // Note: poor performance
    $elemMatch: (name, value) => `(_=${name},_&&_.some&&_.some(function(v){return ${seekRootMatches(value, "v").join("&&")}}))`
};

function ops(name, value, specialOnly) {
    if (isObject(value)) {
        let prefix = "";
        let actions = "";
        for (let prop in value) {
            let v = value[prop];
            if (v !== undefined) {
                if (prop in transforms) {
                    actions += prefix + transforms[prop](name, v);
                    prefix = ANDAND; // compile perf: eliminate length check and array.join
                } else if (prop === "$regex") {
                    actions += prefix + `(${new RegExp(v, value.$options || "").toString()}).test(${name})`;
                    prefix = ANDAND;
                } else if ((prop === "$options" && "$regex" in value) || (compile.$where && prop === "$where") || prop === "$comment") {
                    continue;
                } else if (specialOnly !== true) {
                    actions += prefix + transforms.$eq(name, v);
                    prefix = ANDAND;
                }
            }
        }
        return actions;
    } else if (specialOnly !== true) {
        return transforms.$eq(name, value);
    }
}

function collect(name, query) {
    if (!isObject(query)) {
        return [transforms.$eq(name, query)];
    }

    let matches = [];
    
    for (let field in query) {
        if ((compile.$where && field === "$where") || field === "$comment") continue;

        const prop = compileGetter(name, field);
        let match = ops(prop, query[field], false);

        if (match) { // "" if no match
            matches.push(match);
        } else {
            let found = collect(prop, query[field]);
            matches = matches.length ? matches.concat(found) : found;
        }
    }

    return matches;
}

function rootConditional(op) {
    return function (query) {
        const length = query.length;
        let res = "";
        let prefix = "";
        let at = -1;

        while (++at < length) {
            res += prefix + "(" + seekRootMatches(query[at], ROOT).join("&&") + ")";
            prefix = op; // compile perf: eliminate length check
        }
        
        return [res];
    }
}

const rootConditionals = {
    $and: rootConditional("&&"), // []
    $or: rootConditional("||"), // []
    $nor: (query) => ["!(" + rootConditionals.$or(query)[0] + ")"], // []
    $not: (query) => ["!(" + seekRootMatches(query, ROOT).join("&&") + ")"] // {}
};

function compileWhere(name, $where) {
    let body;
    if (typeof $where === "function") {
        let fn = $where.toString();
        if (fn[0] === "(") { // arrow function, check for non-braced function
            let b = fn.substring(fn.indexOf("=>") + 2).trim();
            if (b[0] !== "{") {
                fn = "{return (" + b + ")}";
            }
        }

        body = fn.substring(fn.indexOf('{') + 1, fn.lastIndexOf('}'));
    } else if (typeof $where === "string") {
        body = 'return (' + $where + ')';
    }

    return `(function () {var obj=this;${body}}).call(${ROOT})`;
}

function findMatches(query) {
    if (!isObject(query)) {
        return [transforms.$eq(ROOT, query)];
    }

    // compile perf: inline
    if (query.$and) return rootConditionals.$and(query.$and);
    if (query.$or) return rootConditionals.$or(query.$or);
    if (query.$nor) return rootConditionals.$nor(query.$nor);
    if (query.$not) return rootConditionals.$not(query.$not);

    let $where;
    let rootMatches = seekRootMatches(query, ROOT);
    if (compile.$where && query.$where) $where = compileWhere(ROOT, query.$where);

    // query perf: concat matches with rootMatches so $where is evaluated last
    if ($where) {
        rootMatches[rootMatches.length] = $where; // .push
    }

    return rootMatches;
}

// This has to be split so special modifiers like $and and $where are ignored
function seekRootMatches(query, root) {
    const rootops = ops(root, query, true);
    return rootops ? [rootops] : collect(root, query);
}

function compile(query) {
	if (query === undefined) return undefined;
	else if (typeof query === "function") return query;
	
    let matches = findMatches(query);
    // _ is used as a temporary variable, useful for checking whether an object is not null
    // e.g. (_=name,_&&_.function(stuff))
    // That way name doesn't have to be repeated twice in the function => faster compile and execution
    // __ is a second temporary for misc. purposes
    const fn = 'var _,__;return ' + (matches.join('&&') || 'true'); // return true if empty object supplied
    return new Function(ROOT, fn);
}

/** Projections */
function findFields(proj) {
    if (!isObject(proj)) {
        return `o=${ROOT}`;
    }

    let ops = "";
    let inclusionMode;
    let include_id = true;
    let include = [];
    let exclude = [];
    let slices = {};
    let elemMatches = {};
    let specials = false;

    for (let field in proj) {
        let value = proj[field];

        if (typeof value === "number") {
            if (field === "_id") {
                include_id = field === 1;
            } else {
                if (inclusionMode === undefined) {
                    inclusionMode = value === 1;
                }
                (inclusionMode ? include : exclude).push(field);
            }
        } else if (isObject(value)) { // $slice, $elemMatch
            if (value.$slice !== undefined) {
                slices[field] = value.$slice;
                specials = true;
            } else if (value.$elemMatch !== undefined) {
                elemMatches[field] = value.$elemMatch;
                specials = true;
            }
        }
    }
    
    if (!include.length && !exclude.length && include_id && !specials) {
        return `o=${ROOT};`
    }

    (include_id ? include : exclude).push("_id");

    if (exclude.length) {
        // Shallow copies properties from `f` to `t`, except if the same property is set to true in `i`.
        // Encountering an object moves everything down one property
        // Harder than simply using delete, but we don't want to mutate stuff.
        ops += `var ig=${compileExistenceMap(exclude)};function cp(f, t, i){for (var p in f){var v=f[p];if(v.constructor===Object){if(!i||i[p]!==true){cp(v,t[p]=t[p]||{},i[p])}}else{if(!i||i[p]!==true){t[p]=v;}}}}cp(${ROOT}, o, ig);`;
    }

    if (include.length) {
        const length = include.length;
        let at = -1;
        while (++at < length) {
            let field = include[at];
            ops += `if(${compileGetter(ROOT, field)}!==void 0)${compileSetter("o", ROOT, field)};`;
        }
    }

    // Limit total returned fields
    for (let field in slices) {
        const slice = slices[field];
        
        // ensure inclusion
        ops += `if(($=${compileGetter(ROOT, slice)})!==void 0)${compileSetter("o", ROOT, slice)};`;
        if (typeof slice === "number") {
            const args = slice < 0 ? slice : `0,${slice}`; // if slice is negative, return elements from the back
                                                         // otherwise from the front, which requires 0,slice
            ops += `($&&$.slice&&(${get}=$.slice(${args})));`;
        } else if (slice instanceof Array) { // [skip, limit]
            const skip = +slice[0];
            const limit = +slice[1];
            const args = slice < 0 ? `${skip - limit},${skip}` : `${skip},${skip + limit}`;
            ops += `($&&$.slice&&(${get}=$.slice(${args})));`;
        }
    }

    // Conditional include/exclude
    for (let field in elemMatches) {
        const match = elemMatches[field];
        const get = compileGetter(ROOT, field);

        // $$ is a counter, $$$ holds the temporary first found match. $elemMatch only sets the first match.
        ops += `$=${get};if($&&$.length){$$=-1;$$$=void 0;while(++$$<$.length){if(${seekRootMatches(match, "$[$$]").join("&&")}){$$$=$[$$];break;}}if($$$!==void 0){${compileSetter("o", ROOT, field, "[$$$]")}}}`;
    }

    return ops;
}

function compileProjection(proj) {
	if (proj === undefined) return undefined;
	else if (typeof proj === "function") return proj;
	
    let ops = findFields(proj);
    // o is used as a temporary value to construct the new object (map)
    // $, $$, and $$$ are temporaries. We don't use _s here because they can potentially clash with queries
    // when using seekRootMatches (see elemMatches). The _s that are defined are for that purpose, otherwise globals
    // might be created.
    const fn = 'var o={},$,$$,$$$,_,_;' + ops + 'return o';
    return new Function(ROOT, fn);
}

// Supports mongo prop names ('a.0.c') using a safe access mechanism
// Does not throw errors if intermediate properties don't exist, returns undefined instead.
// e.g. a[0] doesn't exist, so a[0].c returns undefined instead of an error.
function compileGetter(base, name) {
    const parts = name.split('.');
    const length = parts.length;

    // First property cannot be a number
    if (length === 1) {
        return base + "[" + JSON.stringify(parts[0]) + "]";
    }

    let check = '';
    let n = base;
    let at = -1;

    while (++at < length) {
        if (at > 0) check += ANDAND;

        let value = parts[at];
        const num = +value;
        // Convert to number if possible
        if (num === num) { // isNaN
            value = num;
        } else {
            // JSON.stringify `field` here - it's slightly faster than a .replace
            // JSON.stringify quotes x 1,082,793 ops/sec ±0.51% (94 runs sampled)
            // regex x 922,221 ops/sec ±0.60% (93 runs sampled)
            value = JSON.stringify(value);
        }

        n += "[" + value + "]";
        check += n;
    }

    return '(((' + check + ')!==void 0)?' + n + ':void 0)';
}

// Ensures a specific property exists without unintentionally removing objects.
// e.g. a.b.c: 1, a.b.c
function compileSetter(toBase, fromBase, name, hardcodeValue) {
    const parts = name.split('.');
    const length = parts.length;

    // First property cannot be a number
    if (length === 1) {
        let prop = "[" + JSON.stringify(parts[0]) + "]";
        return `(${toBase}${prop}=${hardcodeValue ? hardcodeValue : fromBase + prop})`
    }

    // We need the safe getter to check if we need to bother with all this work in the first place
    let set = '';
    let n = '';
    let at = -1;
    let atEnd = false;

    // Setters do not support numeric values, so we can simplify this
    while (++at < length) {
        atEnd = at === length - 1;
        if (at > 0) {
            set += ',';
        }

        let value = JSON.stringify(parts[at]);
        n += "[" + value + "]";
        if (atEnd) { // set the actual value
            set += `(${toBase}${n}=${hardcodeValue ? hardcodeValue : fromBase + n})`;
        } else { // sentinel
            set += `(${toBase}${n}=${toBase}${n}||{})`
        }
    }

    return `(${set})`;
}

function compileExistenceMap(fields) {
    const length = fields.length;
    let at = -1;
    let structure = {};

    while (++at < length) {
        const parts = String(fields[at]).split('.');
        const partslen = parts.length;
        let pat = -1;

        if (partslen === 1) {
            structure[parts[0]] = true;
        } else {
            let stack;

            while (++pat < partslen) {
                let name = parts[pat];
                if (pat === partslen - 1) { // end
                    if (stack) {
                        stack[name] = true;
                    } else {
                        structure[name] = true;
                    }
                } else {
                    stack = structure[name] = {};
                }
            }
        }
    }

    return JSON.stringify(structure);
}

function compileArrayMatches(array, fieldName, op) {
    let match = `${fieldName}.length===${array.length}&&`; // precomputed
    let prefix = '';
    const length = array.length;
    let at = -1;

    while (++at < length) {
        match += `${prefix}${fieldName}[${at}]${op}${serialize(array[at])}`;
        prefix = ANDAND;
    }

    return match;
}

// find and findOne ignore undefined and null values
class Query {
    constructor(data) {
        this.data = data;
    }

    // Optimized filters
    find(query, projection) {
        const filter = compile(query);
        const map = compileProjection(projection);
        const ds = this.data;
        const length = ds.length;
        const res = [];
        let residx = 0;
        let at = -1;

        while (++at < length) {
            let value = ds[at];
            if (value != undefined && filter(value)) {
                res[residx++] = map ? map(value) : value;
            }
        }

        return res;
    }

    findOne(query, projection) {
        const filter = compile(query);
        const map = compileProjection(projection);
        const ds = this.data;
        const length = ds.length;
        let at = -1;

        while (++at < length) {
            let value = ds[at];
            if (value != undefined && filter(value)) {
                return map ? map(value) : value;
            }
        }
    }

    update(query, upd, upsert) {
        const filter = compile(query);
        const update = compileUpdate(upd);
        const ds = this.data;
        const length = ds.length;
        const modified = [];
        let modidx = 0;
        let at = -1;

        while (++at < length) {
            let value = ds[at];
            if (value != undefined && filter(value)) {
                modified[modidx++] = at;
            }
        }

        return res;
    }

    count(query) {
        const filter = compile(query);
        const ds = this.data;
        const length = ds.length;
        let at = -1;
        let count = 0;

        while (++at < length) {
            let value = ds[at];
            if (value != undefined && filter(value)) {
                count += 1;
            }
        }
        
        return count;
    }

    get() { return this.data; }
}

function query(data) {
    return new Query(data);
}

query.compile = compile;
query.compile.$where = false;      // Enables $where (string form and function) in the root query object.
                                   // Note: Insecure if query instructions are user supplied
                                   // Performance is good due to inlining.
query.compile.queryArrays = false; // Enables functionality described here: https://docs.mongodb.com/manual/tutorial/query-arrays/
                                   // Note: Required for document date comparison functionality (Dates passed in queries will still be converted using .getTime)
                                   // Note: Poor performance (often 3x slower than without)
                                   // Note: the `{ tags: ["red", "blank"] }` form is still supported, but {tags: "A"} form is not.
query.compile.prop = compileGetter;
query.compile.set = compileSetter;
query.compile.projection = compileProjection;
module.exports = query;