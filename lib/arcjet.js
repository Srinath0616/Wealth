// const  arcjet   = require("@arcjet/next");

// const aj = arcjet({
//     key: process.env.ARCJET_KEY,
//     characteristics: ["userId"],
//     rule:[
//         tokenBucket({
//             mode:"LIVE",
//             refillRate: 2,
//             interval:3600,
//             capacity:2,

//         }),
//     ],
// });

// export default aj;

// import arcjet, { tokenBucket } from "@arcjet/next"; // ✅ ES Module style import

// const aj = arcjet({
//   key: process.env.ARCJET_KEY,
//   characteristics: ["userId"],
//   rules: [
//     // ✅ correct key: 'rules'
//     tokenBucket({
//       mode: "LIVE",
//       refillRate: 10,
//       interval: 3600,
//       capacity: 10,
//     }),
//   ],
// });

// export default aj;
