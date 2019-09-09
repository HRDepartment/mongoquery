var Benchmark = require("benchmark");
var query = require('../index');
var sift3 = require('./_sift3_bench');
var ObjectID = require('./_objectid');
var suite = new Benchmark.Suite;

/*
let array = [];
for (let i = 0; i < 40000; i += 1) {
    array.push({id: i});
}

const q = {id: {$gte: 25049}};
suite.add(JSON.stringify(q) + " x " + array.length + " items", function () {
    query(array).find(q);
});
suite.add("filter", function () {
    array.filter((obj) => obj.id >= 25049);
});
suite.add("findOne", function () {
    query(array).findOne(q);
});

suite.add("sift3", function () {
    sift3(q, array);
});

let small = [{num: 1, name: "ABC"}, {num: 2, name: "Stuff"}, {num: 4, name: "Stuff"}, {num: 9, name: "ABCD"}];
let smallq = {$and: [{num: {$gt: 3}}, {name: "Stuff"}]};
suite.add(JSON.stringify(smallq) + " x " + small.length + " items", function () {
    query(small).find(smallq);
});
suite.add("filter", function () {
    small.filter((obj) => obj.num>3&&obj.name==="Stuff");
});

suite.add("findOne", function () {
    query(small).findOne(smallq);
});
suite.add("sift3", function () {
    sift3(smallq, small);
});
*/

let docs = [];
for (let i = 0; i < 100000; i += 1) {
    docs.push({_id: ObjectID().toHexString(), roll: Math.random()});
}
/*
let oid = docs[42029]._id;
let oidq = {_id: oid};

suite.add("ObjectID search x " + docs.length + " elements", function () {
    query(docs).find(oidq);
});
suite.add("filter", function () {
    docs.filter((obj) => obj._id === oid);
});

suite.add("findOne", function () {
    query(docs).findOne(oidq);
});
suite.add("sift3", function () {
    sift3(oidq, docs);
});*/

let randq = {roll: {$gt: 0.6}};
let compiledq = query.compile(randq);
suite.add("roll search x " + docs.length + " elements", function () {
    query(docs).find(randq);
});
suite.add("find, precompiled query", function () {
    query(docs).find(compiledq);
});
suite.add("filter", function () {
    docs.filter((obj) => obj.roll > 0.6);
});
suite.add("optimal handwritten", function () {
    const length = docs.length;
    const res = [];
    let residx = 0;
    let at = -1;

    while (++at < length) {
        let value = docs[at];
        if (value.roll > 0.6) res[residx++] = value;
    }
});
suite.add("handwritten, for+push", function () {
    const res = [];
    for (let i = 0; i < docs.length; i += 1) {
        if (docs[i].roll > 0.6) {
            res.push(docs[i]);
        }
    }
});
suite.add("handwritten, array with for of+push", function () {
    const res = [];
    for (let doc of docs) {
        if (doc.roll > 0.6) {
            res.push(doc);
        }
    }
});
suite.add("sift3", function () {
    sift3(randq, docs);
});


/*
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

roll search x 30000 elements x 2,031 ops/sec ±0.86% (90 runs sampled)
filter x 516 ops/sec ±0.53% (91 runs sampled)
optimal handwritten x 3,141 ops/sec ±1.73% (87 runs sampled)
sift3 x 120 ops/sec ±0.87% (76 runs sampled)

roll search x 10000 elements x 6,345 ops/sec ±1.13% (90 runs sampled)
filter x 1,524 ops/sec ±0.59% (93 runs sampled)
optimal handwritten x 10,663 ops/sec ±1.89% (93 runs sampled)
sift3 x 360 ops/sec ±1.81% (89 runs sampled)

roll search x 5000 elements x 11,911 ops/sec ±1.94% (90 runs sampled)
filter x 3,005 ops/sec ±0.66% (95 runs sampled)
optimal handwritten x 21,822 ops/sec ±0.68% (93 runs sampled)
sift3 x 727 ops/sec ±0.87% (92 runs sampled)

roll search x 2000 elements x 31,077 ops/sec ±2.62% (90 runs sampled)
filter x 7,916 ops/sec ±0.76% (92 runs sampled)
optimal handwritten x 79,551 ops/sec ±1.14% (94 runs sampled)
sift3 x 1,801 ops/sec ±1.97% (92 runs sampled)

roll search x 750 elements x 75,955 ops/sec ±1.14% (90 runs sampled)
filter x 19,983 ops/sec ±1.39% (91 runs sampled)
optimal handwritten x 291,310 ops/sec ±1.09% (88 runs sampled)
sift3 x 4,771 ops/sec ±1.23% (94 runs sampled)

roll search x 375 elements x 133,120 ops/sec ±0.72% (93 runs sampled)
filter x 38,458 ops/sec ±2.88% (88 runs sampled)
optimal handwritten x 621,842 ops/sec ±2.59% (85 runs sampled)
sift3 x 9,383 ops/sec ±1.21% (90 runs sampled)

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

For smaller values, precompilation is strongly recommended. Precompilation loses value
when .find is roughly 60% as fast as optimal handwritten.

roll search x 20 elements x 363,491 ops/sec ±0.80% (94 runs sampled)
find, precompiled query x 4,739,389 ops/sec ±0.80% (94 runs sampled)
filter x 724,827 ops/sec ±0.57% (95 runs sampled)
optimal handwritten x 11,215,359 ops/sec ±3.08% (90 runs sampled)
sift3 x 154,331 ops/sec ±0.68% (90 runs sampled)

For large datasets, query (no precompilation) is roughly 66% as fast as the most optimal written loop.
filter is 16% as fast
common handwritten loops are 25% as fast
*/

// Runner
suite
.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').map('name'));
})
// run async
.run({ 'async': true });