const {
  transformPages,
  fetchPages,
  calculateNewPosts,
  getNewThreadIds,
} = require("./threads");
const utils = require("./utils");

// async function start() {
//   try {
//     const initThreads = await transformPages(await fetchPages());
//     let prevThreads = initThreads;

//     async function runCycle() {
//       try {
//         const currentThreads = await transformPages(await fetchPages());
//         console.log("New Posts: " + calculateNewPosts(prevThreads, currentThreads));
//         console.log(
//           "New threads: " + getNewThreadIds(prevThreads, currentThreads).length
//         );
//         console.log(getNewThreadIds(prevThreads, currentThreads));
//         prevThreads = { ...currentThreads };
//       } catch (e) {
//         console.log(e);
//       }
//     }

//     setInterval(runCycle, 10000);
//   } catch (e) {
//     console.log(e);
//   }
// }

/**
 * Cycle generator
 *
 * @async
 * @generator
 * @function start
 * @param {number} miliseconds - How often to run a cycle in ms
 * @return {Object} Iterator
 */

async function* start(miliseconds) {
  try {
    const initThreads = transformPages(await fetchPages(miliseconds));
    var prevThreads = initThreads;
  } catch (e) {
    console.log(e);
  }
  async function runCycle() {
    const currentThreads = transformPages(await fetchPages(miliseconds));
    console.log("New Posts: " + calculateNewPosts(prevThreads, currentThreads));
    console.log(
      "New threads: " + getNewThreadIds(prevThreads, currentThreads).length
    );
    console.log(getNewThreadIds(prevThreads, currentThreads));
    prevThreads = { ...currentThreads };
  }
  await utils.wait(miliseconds);

  while (true) {
    try {
      const beginCycle = Date.now();
      await runCycle();
      await utils.wait(miliseconds - (Date.now() - beginCycle));
      yield;
    } catch (e) {
      console.log(e);
    }
  }
}

async function main() {
  for await (cycle of start(60000)) {
    console.log("cycle");
  }
}

main();
