#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const projectRoot = __dirname;
const defaultOutput = path.join(projectRoot, "供应链计划平台_V1.1_销售预测日级填报_source.txt");
const outputPath = path.resolve(process.argv[2] || defaultOutput);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".txt",
  ".ts",
  ".tsx",
  ".xml",
  ".yaml",
  ".yml",
]);

function walk(currentDir) {
  return fs.readdirSync(currentDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    .flatMap((entry) => {
      if (entry.name === ".DS_Store" || entry.name === "node_modules" || entry.name === "dist") {
        return [];
      }

      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) return walk(absolutePath);
      if (!entry.isFile()) return [];
      if (absolutePath === outputPath) return [];
      return [absolutePath];
    });
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function contentEndsWithNewline(buffer) {
  return buffer.length > 0 && buffer[buffer.length - 1] === 0x0a;
}

function fileSection(absolutePath) {
  const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join("/");
  const buffer = fs.readFileSync(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();
  const isText = textExtensions.has(extension);
  const type = isText ? "text/utf-8" : "binary/base64";
  const body = isText ? buffer.toString("utf8") : buffer.toString("base64");
  const newlineState = isText ? String(contentEndsWithNewline(buffer)) : "n/a";

  return [
    "[FILE]",
    `PATH: ${relativePath}`,
    `TYPE: ${type}`,
    `BYTES: ${buffer.length}`,
    `SHA256: ${sha256(buffer)}`,
    `CONTENT_ENDS_WITH_NEWLINE: ${newlineState}`,
    "----- BEGIN CONTENT -----",
    body,
    "----- END CONTENT -----",
    "",
  ].join("\n");
}

const files = walk(projectRoot);
const generatedAt = new Date().toISOString();
const header = [
  "# 供应链计划平台 V1.1 原型完整源码 TXT 备份",
  "",
  "本文件是可恢复的纯文本源码归档。",
  "text/utf-8 文件保留原始文本内容；binary/base64 文件使用 Base64 编码。",
  "每个文件均记录相对路径、类型、原始字节数、SHA-256 和文本末尾换行状态。",
  "",
  `PROJECT_ROOT: ${projectRoot}`,
  `GENERATED_AT_UTC: ${generatedAt}`,
  `FILE_COUNT: ${files.length}`,
  "",
  "恢复方式：按 PATH 创建文件；text/utf-8 直接写回 CONTENT，binary/base64 先 Base64 解码；用 SHA256 校验原始字节。",
  "",
  "============================================================",
  "",
].join("\n");

const archive = header + files.map(fileSection).join("\n");
fs.writeFileSync(outputPath, archive, "utf8");
console.log(`Wrote ${files.length} files to ${outputPath}`);
