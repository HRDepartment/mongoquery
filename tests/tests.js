const data$eq = [
    { _id: 1, item: { name: "ab", code: "123" }, qty: 15, tags: [ "A", "B", "C" ] },
    { _id: 2, item: { name: "cd", code: "123" }, qty: 20, tags: [ "B" ] },
    { _id: 3, item: { name: "ij", code: "456" }, qty: 25, tags: [ "A", "B" ] },
    { _id: 4, item: { name: "xy", code: "456" }, qty: 30, tags: [ "B", "A" ] },
    { _id: 5, item: { name: "mn", code: "000" }, qty: 20, tags: [ [ "A", "B" ], "C" ] }
];

const dataqueryarray = [
   { item: "journal", qty: 25, tags: ["blank", "red"], dim_cm: [ 14, 21 ] },
   { item: "notebook", qty: 50, tags: ["red", "blank"], dim_cm: [ 14, 21 ] },
   { item: "paper", qty: 100, tags: ["red", "blank", "plain"], dim_cm: [ 14, 21 ] },
   { item: "planner", qty: 75, tags: ["blank", "red"], dim_cm: [ 22.85, 30 ] },
   { item: "postcard", qty: 45, tags: ["blue"], dim_cm: [ 10, 15.25 ] }
];

module.exports = {
    "query:$eq (explicit)": {
        data: data$eq,
        query: { qty: { $eq: 20 } },
        expected: [
            { _id: 2, item: { name: "cd", code: "123" }, qty: 20, tags: [ "B" ] },
            { _id: 5, item: { name: "mn", code: "000" }, qty: 20, tags: [ [ "A", "B" ], "C" ] }
        ]
    },
    "query:$eq (implicit)": {
        data: data$eq,
        query: { qty: 20 },
        expected: [
            { _id: 2, item: { name: "cd", code: "123" }, qty: 20, tags: [ "B" ] },
            { _id: 5, item: { name: "mn", code: "000" }, qty: 20, tags: [ [ "A", "B" ], "C" ] }
        ]
    },
    "query:$eq embedded": {
        data: data$eq,
        query: { "item.name": "ab" },
        expected: [
            { _id: 1, item: { name: "ab", code: "123" }, qty: 15, tags: [ "A", "B", "C" ] }
        ]
    },
    "query:$eq array": {
        data: data$eq,
        query: { "tags": "B" },
        expected: [
            { _id: 1, item: { name: "ab", code: "123" }, qty: 15, tags: [ "A", "B", "C" ] },
            { _id: 2, item: { name: "cd", code: "123" }, qty: 20, tags: [ "B" ] },
            { _id: 3, item: { name: "ij", code: "456" }, qty: 25, tags: [ "A", "B" ] },
            { _id: 4, item: { name: "xy", code: "456" }, qty: 30, tags: [ "B", "A" ] }
        ]
    },
    "query:array $eq array": { // https://docs.mongodb.com/v3.4/tutorial/query-arrays/
        data: dataqueryarray,
        query: { tags: ["red", "blank"] },
        expected: [
            { item: "notebook", qty: 50, tags: ["red", "blank"], dim_cm: [ 14, 21 ] },
        ]
    },
    "projection:$elemMatch": { // https://docs.mongodb.com/v3.4/reference/operator/projection/elemMatch/
        data: [
            {
                _id: 1,
                zipcode: "63109",
                students: [
                    { name: "john", school: 102, age: 10 },
                    { name: "jess", school: 102, age: 11 },
                    { name: "jeff", school: 108, age: 15 }
                ]
            },
            {
                _id: 2,
                zipcode: "63110",
                students: [
                    { name: "ajax", school: 100, age: 7 },
                    { name: "achilles", school: 100, age: 8 },
                ]
            },
            {
                _id: 3,
                zipcode: "63109",
                students: [
                    { name: "ajax", school: 100, age: 7 },
                    { name: "achilles", school: 100, age: 8 },
                ]
            },
            {
                _id: 4,
                zipcode: "63109",
                students: [
                    { name: "barney", school: 102, age: 7 },
                    { name: "ruth", school: 102, age: 16 },
                ]
            }
        ],
        query: {zipcode: "63109"},
        projection: { students: { $elemMatch: { school: 102 } } },
        expected: [
            { "_id" : 1, "students" : [ { "name" : "john", "school" : 102, "age" : 10 } ] },
            { "_id" : 3 },
            { "_id" : 4, "students" : [ { "name" : "barney", "school" : 102, "age" : 7 } ] }
        ]
    }
};