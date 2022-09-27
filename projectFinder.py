# pylint: disable=missing-class-docstring
import json
from pydriller import *
import pathlib
import os

class JSONData:
    def __init__(self, url, path, commit, file):
        self.url = url
        self.path = path
        self.commit = commit
        self.file = file
    
    def __str__(self):
        return f"{self.url} {self.path} {self.commit} {self.file}"

result = []
urls = []
filePath = "/Users/karanmehta/temp/ManyTypes4TypeScript_zenodo/50k_types/test.jsonl"

with open(filePath, 'r') as json_file:
    json_list = list(json_file)

for json_str in json_list:
    temp = json.loads(json_str)
    urls.append(temp["url"])
    obj = JSONData(temp["url"], temp["path"], temp["commit_hash"], temp["file"])
    result.append(obj)

for commit in Repository(urls, num_workers = 1000).traverse_commits(): 
    for modifiedFile in commit.modified_files:
        oldPath = modifiedFile.old_path
        newPath = modifiedFile.new_path
        if (oldPath != None and newPath != None):
            oldExt = pathlib.Path(oldPath).suffix
            newExt = pathlib.Path(newPath).suffix
            if (oldExt == ".js" and newExt == ".ts" and modifiedFile.source_code_before != None):
                dirPath = r'/Users/karanmehta/UCD/GSR GitHobbit/auto/files/' + commit.project_name + "/"
                fileName = os.path.splitext(modifiedFile.filename)[0]
                if not (os.path.exists(dirPath)):
                    os.makedirs(dirPath)
                    old = open(dirPath + fileName + ".js", "w")
                    old.write(modifiedFile.source_code_before)
                    old.close()
                    new = open(dirPath + fileName + ".ts", "w")
                    new.write(modifiedFile.source_code)
                    new.close()