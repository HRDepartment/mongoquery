# mongoquery

Blazing fast MongoDB-style object querying (filter) and projecting (map).

`npm i --save mongoquery`

`yarn add mongoquery`

## Features

For query documentation, see https://docs.mongodb.com/manual/reference/operator/query/. Differences are noted here. Compatiblity is a goal, sometimes compromises are made for performance.

- $eq, $gt, $gte, $lt, $lte, $ne, $in, $nin, $or, $and, $not, nor, $exists, $type, $mod, $regex (+ $options if $regex is a string), $where, \$comment (ignored)
- Regex literals in $eq, $gt
- Date literals in comparison operators (using .getTime);
  Note: Dates in the document are only converted when compile.queryArrays == true (slow).
  In both instances, document value may be a Unix timestamp in ms (as returned by .getTime).
  {date: new Date()} in the query will always compile down to the .getTime() value.
- Array querying [compile.queryArrays] ({tags: "red"} matches the document if "red" is in the array `tags`)
  Note: This butchers performance, hence why it's disabled by default.
  Strict array matches are available regardless (e.g. {arr: ["a", "b"]} -> document arr must have length 2, arr[0] must be "a" and arr[1] "b")
- $where is enabled with [compile.$where], disabled by default.
- Non-object datasets and queries. If the dataset is an array, literal queries are accepted too (i.e. strings, regexes, bools, etc.)
  query([1, 2, 3]).find({$gte: 2}) -> 2, 3
   query(["aa", "bb", "ccc"]).find(/^[a-z]{2}$/) -> aa, bb
  Note: `null` and `undefined` inside array datasets are ignored.
- Precompilation, providing a function compatible with Array.prototype.filter.
  let q = query.compile({num: {\$gt: 2}})
  query([1, 2, 3]).find(q) or [1, 2, 3].filter(q)
- Nested (dot) properties. e.g. 'abc.0.x'
- Projections: $slice, $elemMatch (\$ not supported since it's tied to the initial query), \_id special case, inclusion/exclusion syntax
- Safe property access: like MongoDB, properties do not have to exist, even nested ones. This comes at a minor hit to performance but enables schemaless data.
- Compatibility: ES3 + shims (JSON.stringify, Array.prototype.indexOf, [optional] Array.prototype.some (for projection \$elemMatch and queries queryArrays runtime))

### Methods

`query(data).find(query, projection)` [document,...]

`query(data).findOne(query, projection)` => document

`query(data).findWithIndex(query, projection)` => [[document, index],...]

`query(data).findOneWithIndex(query, projection)` => [document, index]

`query.compile(query)` => function

`query.compile.projection(projection)` => function

## Benchmarks

mongoquery vs Array.prototype.filter vs optimal handwritten (using while loop) vs sift.js v3

Query: `{roll: {$gt: 0.6}}`

```
node -v
v8.2.1
Operating System: Windows 10 Home 64-bit (10.0, Build 14393) (14393.rs1_release.170602-2252)
Processor: Intel(R) Core(TM) i5-6400 CPU @ 2.70GHz (4 CPUs), ~2.7GHz
Memory: 8192MB RAM

roll search x 100000 elements x 600 ops/sec ±2.35% (89 runs sampled)
find, precompiled query x 614 ops/sec ±0.73% (92 runs sampled)
filter x 148 ops/sec ±1.19% (82 runs sampled)
optimal handwritten x 921 ops/sec ±0.98% (93 runs sampled)
handwritten, for+push x 230 ops/sec ±0.96% (88 runs sampled)
handwritten, array with for of+push x 873 ops/sec ±1.90% (92 runs sampled)
sift3 x 34.17 ops/sec ±3.19% (60 runs sampled)

roll search x 50000 elements x 1,216 ops/sec ±0.63% (93 runs sampled)
filter x 303 ops/sec ±0.52% (89 runs sampled)
optimal handwritten x 1,934 ops/sec ±1.64% (91 runs sampled)
sift3 x 71.88 ops/sec ±1.15% (73 runs sampled)

roll search x 10000 elements x 6,345 ops/sec ±1.13% (90 runs sampled)
filter x 1,524 ops/sec ±0.59% (93 runs sampled)
optimal handwritten x 10,663 ops/sec ±1.89% (93 runs sampled)
sift3 x 360 ops/sec ±1.81% (89 runs sampled)

roll search x 5000 elements x 11,911 ops/sec ±1.94% (90 runs sampled)
filter x 3,005 ops/sec ±0.66% (95 runs sampled)
optimal handwritten x 21,822 ops/sec ±0.68% (93 runs sampled)
sift3 x 727 ops/sec ±0.87% (92 runs sampled)

roll search x 1000 elements x 31,077 ops/sec ±2.62% (90 runs sampled)
filter x 7,916 ops/sec ±0.76% (92 runs sampled)
optimal handwritten x 79,551 ops/sec ±1.14% (94 runs sampled)
sift3 x 1,801 ops/sec ±1.97% (92 runs sampled)

roll search x 100 elements x 272,811 ops/sec ±1.24% (88 runs sampled)
filter x 151,279 ops/sec ±1.53% (87 runs sampled)
optimal handwritten x 2,803,435 ops/sec ±1.41% (91 runs sampled)
sift3 x 33,633 ops/sec ±1.87% (88 runs sampled)

roll search x 50 elements x 314,379 ops/sec ±1.55% (94 runs sampled)
filter x 284,453 ops/sec ±0.48% (93 runs sampled)
optimal handwritten x 4,935,102 ops/sec ±1.53% (94 runs sampled)
sift3 x 66,226 ops/sec ±1.63% (91 runs sampled)

roll search x 20 elements x 349,530 ops/sec ±2.25% (87 runs sampled)
filter x 641,445 ops/sec ±3.31% (81 runs sampled)
optimal handwritten x 11,151,816 ops/sec ±1.71% (89 runs sampled)
sift3 x 153,855 ops/sec ±1.79% (90 runs sampled)
```

[https://github.com/crcn/sift.js/](sift.js) is a similar project that offers much greater versality and extensible functionality (albeit only queries), however it is not as aggressively tuned as mongoquery by its very nature. mongoquery makes use of `new Function` whereas sift.js does not. It's still a fine choice for small datasets, especially due to its extensible nature.

## How does it work?

MongoDB-style queries are compiled with `new Function`. This limits extensibility, but provides immense performance gains. Simple benchmarks (one filter) show that query(...).find with a pre-compiled query is at least 6x faster than Array.prototype.filter. Without pre-compilation, .find is still faster than filter with datasets that are about 50 elements or larger. With large datasets (thousands of elements), .find without pre-compilation is 4x faster than filter. The larger the dataset, the fewer gains precompilation provide. This depends on query complexity, of course. Complex queries benefit more.

mongoquery also implements a `findOne` function akin to MongoDB. It returns the first matched value. This is similar to `Array.prototype.find` (in fact, compiled queries can be fed to `find` to do the same thing.)

`$where` and array querying can be toggled by setting `query.compile.$where` and `query.compile.queryArrays` (both false by default due to security in the case of \$where and performance in the case of queryArrays). This impacts how queries are compiled. If you need these features, enable them when you `require` the module. Should you need to toggle them on a per-query basis, you can enable them before calling `query` or `query.compile` and disable (or restore their value) afterwards.

Yes, it's global state, but wrappers are always a possiblity, and I think you should decide whether the use of these is acceptable anyways. Note that outside of security concerns, (\$where runs in the context of its caller, so it has access to `require` etc. - depending on safe use case this can be hacky feature as well) \$where is very performant unlike Mongo, because the query is inlined in the `new Function` compilation.

Tip: Want to easily implement a pre-compilation layer? Use $comment in your queries and use an Object (with $comment as key and the query as value) to cache functions.

Tip: Indexes are not supported, but you can easily implement an \_id index (Map or objects) on the object in your indexing layer of choice. Check the presence of \_id in q (.find(q)) and do a quick lookup. More sophisticated indexes require more work.

## License

[MIT](LICENSE.md)
