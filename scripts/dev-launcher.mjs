import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const url = process.env.AFT_DEV_URL || `http://localhost:${port}`;
const shouldOpen = process.env.AFT_OPEN_BROWSER !== "false" && process.env.BROWSER !== "none" && !process.env.CI;
let opened = false;

function openBrowser() {
  if (!shouldOpen || opened) return;
  opened = true;

  let command;
  let args;
  if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "win32") {
    // Explorer delegates the URL to the user's configured default browser and avoids
    // cmd.exe quoting/empty-title issues that can raise spawn EINVAL on PowerShell.
    command = "explorer.exe";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const browser = spawn(command, args, { detached: true, stdio: "ignore" });
  browser.on("error", () => {
    console.log(`\nAFT portal is running at ${url}`);
    console.log("The default browser could not be opened automatically; copy the URL above into a browser.");
  });
  browser.unref();
}

const serverCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
const serverArgs = process.platform === "win32"
  ? ["/d", "/s", "/c", "npm.cmd run dev:server"]
  : ["run", "dev:server"];
const server = spawn(serverCommand, serverArgs, {
  env: { ...process.env, NODE_ENV: "development" },
  stdio: ["inherit", "pipe", "pipe"],
  windowsHide: false,
});

const forward = (stream, target) => {
  stream.on("data", (chunk) => {
    target.write(chunk);
    if (chunk.toString().includes("Server running on")) openBrowser();
  });
};

forward(server.stdout, process.stdout);
forward(server.stderr, process.stderr);
const fallbackTimer = setTimeout(openBrowser, 3500);
fallbackTimer.unref();

const stop = (signal) => {
  clearTimeout(fallbackTimer);
  if (!server.killed) server.kill(signal);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

server.on("close", (code, signal) => {
  clearTimeout(fallbackTimer);
  process.exit(typeof code === "number" ? code : signal ? 1 : 0);
});
