const assert = require('assert');
const query = require('../index');
const tests = require('./tests');

let passed = 0;
let failed = 0;
for (let name in tests) {
    let test = tests[name];
    let result = query(test.data).find(test.query, test.projection);

    if (test.$where) {
        query.compile.$where = true;
    }
    if (test.queryArrays) {
        query.compile.queryArrays = true;
    }

    try {
        assert.deepStrictEqual(result, test.expected, name);
        passed += 1;
        console.log('Passed test: ' + name);
    } catch (ex) {
        failed += 1;
        console.error("Failed test `" + name + "`");
        console.error("Expected:", JSON.stringify(test.expected));
        console.error("Got:", JSON.stringify(result));

        if (test.query) {
            console.error("Compiled query:", query.compile(test.query).toString());
        }
        if (test.projection) {
            console.error("Compiled projection:", query.compile.projection(test.projection).toString());
        }
    }

    query.compile.$where = false;
    query.compile.queryArrays = false;
}

console.log(`Passed ${passed} tests, failed ${failed} tests.`);

const data = [{num: 1}, {num: 2}, {num: 3}, {num: 0}];
console.log(query(data).find({num: {$gt: 1}}));


const data2 = [{num: 1}, {num: 2}, {num: 3}, {num: 0}, {num: 2}];
console.log(query(data2).find({num: 2}));

const data3 = [{num: {id: 123}}, {num: {id: "123"}}, {num: {id: "123"}}, {num: {id: 123}}];

console.log(query(data3).find({$where: 'this.num.id === "123"'}));
console.log(query(data3).find({$where: () => obj.num.id === 123 }));

let small = [1,2,3,4,6,7,1,0,9,3,6,7];
let smallq = {$gt: 3};
console.log(query(small).find(smallq));

console.log(query.compile.prop("data", 'a.b.c.0'));

let strs = "ad ab ac dd ee ff".split(" ");
let regex = /a/;
console.log(query(strs).find(regex));


let regexarr = [{name: "AA"}, {name: "BB"}, {name: "CC"}, {name: "D"}, {name: "EEE"}];
let regexaz = /^[A-Z]{2}$/;
console.log(query(regexarr).find({name: regexaz}), query(regexarr).find({name: {$regex: regexaz}}));

let types = [1,true,"stuff"];
console.log(query(types).find({$type: String}));

let typesdate = [1,true,"stuff", new Date()];
console.log(query(typesdate).find({$type: Date}));

let $cond = [
    { name: 'Craig', state: 'MN' },
    { name: 'Tim', state: 'MN' },
    { name: 'Joe', state: 'CA' }
];

//filtered: [ { name: 'Craig', state: 'MN' }]
console.log(query($cond).find({ $and: [ { name: 'Craig' }, { state: 'MN' } ] }));

//filtered: [ { name: 'Craig', state: 'MN' }, { name: 'Tim', state: 'MN' }]
console.log(query($cond).find({ $or: [ { name: 'Craig' }, { state: 'MN' } ] }));

//filtered: [ { name: 'Joe', state: 'CA' }]
console.log(query($cond).find({ $nor: [ { name: 'Craig' }, { state: 'MN' } ] }));

const names =  ['craig','tim','jake'];
console.log(query(names).find({$not:{$in:['craig','tim']}})); //['jake']
console.log(query(names).find({$not:{$size:5}})); //['tim','jake']

const elemmatch = [
    { _id: 1, results: [ { product: "abc", score: 10 }, { product: "xyz", score: 5 } ] },
    { _id: 2, results: [ { product: "abc", score: 8 }, { product: "xyz", score: 7 } ] },
    { _id: 3, results: [ { product: "abc", score: 7 }, { product: "xyz", score: 8 } ] }
];
const elemmatchq = { results: { $elemMatch: { product: "xyz", score: { $gte: 8 } } } }
console.log(query(elemmatch).find(elemmatchq));
// { "_id" : 3, "results" : [ { "product" : "abc", "score" : 7 }, { "product" : "xyz", "score" : 8 } ] }

console.log(query.compile.projection({abcd: 0, 'stuff.s': 0})({abcd: true, abcdd: false, abde: 12, stuff: {s: 'd', b: 'c'}}));

console.log(query(elemmatch).find(elemmatchq, {_id: 0}));
console.log(query.compile.projection({_id: 0}).toString());
