"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_os_walk_1 = require("node-os-walk");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
var fp = [];
const rootPath = path.resolve(__dirname, "/Users/karanmehta/Downloads/files-2/files");
function hasTyping(path) {
    let data = fs.readFileSync(path, "utf8");
    {
        let txtByLine = data.split("\n");
        for (let i = 0; i < txtByLine.length; i++) {
            if (txtByLine[i].includes(":")) {
                // console.log(txtByLine[i])
                return true;
            }
        }
    }
    ;
    return false;
}
async function main() {
    let outputFilePath = "/Users/karanmehta/Downloads/annotationFilePaths.txt";
    fs.writeFileSync(outputFilePath, "");
    for await (const [root, dirs, files] of (0, node_os_walk_1.walk)(rootPath)) {
        for (const file of files) {
            var fileName = file.name.split('.');
            var ext = fileName[fileName.length - 1];
            if (ext == "ts") {
                let fileAddress = path.resolve(root, file.name);
                let isAnnotated = hasTyping(fileAddress);
                if (isAnnotated) {
                    fs.appendFileSync(outputFilePath, fileAddress + "\n");
                    fp.push([root, fileAddress]);
                }
            }
        }
    }
}
main();
