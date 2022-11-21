import { walk } from "node-os-walk";
import * as path from "path";
import * as fs from 'fs';

var fp = []
const rootPath = path.resolve(__dirname, "/Users/karanmehta/Downloads/files-2/files");




function hasTyping(path: string) {
    let data = fs.readFileSync(path, "utf8"); {
      let txtByLine = data.split("\n");
      for (let i = 0; i < txtByLine.length; i++) {
        if (txtByLine[i].includes(":")) {
          // console.log(txtByLine[i])
          return true;
        }
      }
    };
  return false;
}

async function main() {
  let outputFilePath : string = "/Users/karanmehta/Downloads/annotationFilePaths.txt";
  fs.writeFileSync(outputFilePath, "");
  for await (const [root, dirs, files] of walk(rootPath)) {
    for (const file of files) {
      var fileName = file.name.split('.');
      var ext = fileName[fileName.length - 1];
      if (ext == "ts") {
        let fileAddress : string = path.resolve(root, file.name);
        let isAnnotated : boolean = hasTyping(fileAddress);
        if (isAnnotated) {
          fs.appendFileSync(outputFilePath, fileAddress + "\n")
          fp.push([root, fileAddress])
        }
      }
    }
  }
}

main()
