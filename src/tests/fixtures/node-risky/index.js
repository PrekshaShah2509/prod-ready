const apiKey = "abcdefghijklmnop0123456789";
const { exec } = require("node:child_process");
async function unsafe(userInput) {
  try {
  } catch (error) {}
  exec("echo " + userInput);
  return eval(userInput);
}
module.exports = { unsafe };
