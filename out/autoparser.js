"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_readdir_recursive_1 = __importDefault(require("fs-readdir-recursive"));
const typescript_1 = __importDefault(require("typescript"));
const fs_1 = require("fs");
const node_fetch_1 = __importDefault(require("node-fetch"));
const PORT_NUM = 9090;
var project = null;
var program = null;
var complete_list_of_types = [];
var staticAnalysisTypes = 0;
var modelBasedAnalysisTypes = 0;
var common = 0;
var couldNotInfer = 0;
var importSet = new Set();
let basicTypes = new Map();
basicTypes.set(typescript_1.default.SyntaxKind.BooleanKeyword, "boolean");
basicTypes.set(typescript_1.default.SyntaxKind.BooleanKeyword, "boolean");
basicTypes.set(typescript_1.default.SyntaxKind.TrueKeyword, "boolean");
basicTypes.set(typescript_1.default.SyntaxKind.FalseKeyword, "boolean");
basicTypes.set(typescript_1.default.SyntaxKind.NumberKeyword, "number");
basicTypes.set(typescript_1.default.SyntaxKind.StringKeyword, "string");
basicTypes.set(typescript_1.default.SyntaxKind.SymbolKeyword, "symbol");
basicTypes.set(typescript_1.default.SyntaxKind.EnumKeyword, "enum");
basicTypes.set(typescript_1.default.SyntaxKind.VoidKeyword, "void");
basicTypes.set(typescript_1.default.SyntaxKind.ObjectKeyword, "object");
basicTypes.set(typescript_1.default.SyntaxKind.BigIntKeyword, "bigint");
basicTypes.set(typescript_1.default.SyntaxKind.UndefinedKeyword, "undefined");
basicTypes.set(typescript_1.default.SyntaxKind.NullKeyword, "null");
let ignoredTypes = new Set();
ignoredTypes.add(typescript_1.default.SyntaxKind.MappedType);
ignoredTypes.add(typescript_1.default.SyntaxKind.ConditionalType);
ignoredTypes.add(typescript_1.default.SyntaxKind.ThisType);
ignoredTypes.add(typescript_1.default.SyntaxKind.UnknownKeyword);
ignoredTypes.add(typescript_1.default.SyntaxKind.IndexedAccessType);
ignoredTypes.add(typescript_1.default.SyntaxKind.UndefinedKeyword);
ignoredTypes.add(typescript_1.default.SyntaxKind.NeverKeyword);
ignoredTypes.add(typescript_1.default.SyntaxKind.TypeOperator);
// ignoredTypes.add(ts.SyntaxKind.NullKeyword);
ignoredTypes.add(typescript_1.default.SyntaxKind.IntersectionType);
ignoredTypes.add(typescript_1.default.SyntaxKind.TypeQuery);
const filteredFiles = (0, fs_readdir_recursive_1.default)(__dirname).filter(item => item.endsWith(".js"));
var proj = null;
function readfile(fileName) {
    return (0, fs_1.readFileSync)(fileName, 'utf-8');
}
function parseEntityName(n) {
    if (n.kind === typescript_1.default.SyntaxKind.Identifier) {
        return n.text;
    }
    else {
        return parseEntityName(n.left) + "." + n.right.text;
    }
}
function parseType(node) {
    var type = undefined;
    if (node.kind === typescript_1.default.SyntaxKind.AnyKeyword) {
        return "any";
    }
    else if (typescript_1.default.isTypeReferenceNode(node)) {
        let n = node;
        type = parseEntityName(n.typeName);
    }
    else if (basicTypes.has(node.kind)) {
        type = basicTypes.get(node.kind);
    }
    else if (node.kind === typescript_1.default.SyntaxKind.ArrayType) {
        type = "array";
    }
    else if (node.kind === typescript_1.default.SyntaxKind.TypeLiteral) {
        let n = node;
        return "object";
    }
    else if (node.kind === typescript_1.default.SyntaxKind.FunctionType || node.kind === typescript_1.default.SyntaxKind.ConstructorType) {
        let n = node;
        let ret = parseType(n.type);
        type = ret;
    }
    else if (node.kind === typescript_1.default.SyntaxKind.UnionType) {
        let n = node;
        let typesofUnion = [];
        var i;
        for (i = 0; i < n.types.length; i++) {
            typesofUnion.push(parseType(n.types[String(i)]));
        }
        typesofUnion = [...new Set(typesofUnion)];
        typesofUnion = typesofUnion.filter(function (x) {
            return x !== 'any';
        });
        if (typesofUnion.length === 2) {
            if (typesofUnion[1] === "null" || typesofUnion[1] === "undefined") {
                return typesofUnion[0];
            }
            else {
                return 'any';
            }
        }
        else if (typesofUnion.length === 1) {
            return typesofUnion[0];
        }
        else {
            return 'any';
        }
    }
    else if (ignoredTypes.has(node.kind)) {
        return "any";
    }
    else if (node.kind === typescript_1.default.SyntaxKind.LiteralType) {
        let n = node;
        switch (n.literal.kind) {
            case typescript_1.default.SyntaxKind.StringLiteral:
                return "string";
            case typescript_1.default.SyntaxKind.TrueKeyword:
            case typescript_1.default.SyntaxKind.FalseKeyword:
                return "boolean";
            case typescript_1.default.SyntaxKind.NumericLiteral:
                return "number";
            case typescript_1.default.SyntaxKind.NullKeyword:
                return "null";
            default:
                return "any";
        }
    }
    else if (node.kind === typescript_1.default.SyntaxKind.ParenthesizedType) {
        let n = node;
        return parseType(n.type);
    }
    else if (node.kind === typescript_1.default.SyntaxKind.FirstTypeNode || node.kind === typescript_1.default.SyntaxKind.LastTypeNode) {
        type = "boolean";
    }
    else if (node.kind === typescript_1.default.SyntaxKind.TupleType) {
        type = "array";
    }
    else {
        type = "any";
    }
    return type;
}
function fast_linter(checker, sourceFile, loc, word) {
    var tokens = [];
    var inferred_type = undefined;
    var word_index = undefined;
    var typeCache = undefined;
    function visit(node) {
        if (node.kind === typescript_1.default.SyntaxKind.Identifier) {
            if (node.getText() === word && (node.pos < loc + 20 && node.pos > loc - 20)) {
                word_index = tokens.length - 1;
                inferred_type = typeCache;
            }
        }
        else if (node.kind === typescript_1.default.SyntaxKind.VariableDeclaration || (node.kind === typescript_1.default.SyntaxKind.Parameter && node.parent.kind !== typescript_1.default.SyntaxKind.FunctionType) || node.kind === typescript_1.default.SyntaxKind.FunctionDeclaration || node.kind === typescript_1.default.SyntaxKind.MethodDeclaration) {
            if (node.hasOwnProperty('name')) {
                let symbol = checker.getSymbolAtLocation(node['name']);
                if (symbol) {
                    const ty = checker.getTypeAtLocation(node);
                    const n = checker.typeToTypeNode(ty, undefined, undefined);
                    typeCache = parseType(n);
                }
            }
        }
        for (var child of node.getChildren(sourceFile)) {
            if (child.getChildren().length === 0 && child.getText().length > 0) {
                tokens.push(child.getText());
            }
            visit(child);
        }
        return node;
    }
    if (loc != null) {
        typescript_1.default.visitNode(sourceFile, visit);
        //console.log(tokens);
        return [tokens, inferred_type, word_index];
    }
}
var tokens_at_start = [];
function create_word_indexes(sourceFile) {
    var tokens = [];
    function visit(node) {
        if (node.kind === typescript_1.default.SyntaxKind.Identifier) {
            tokens_at_start.push([node.getText, tokens.length - 1]);
        }
        for (var child of node.getChildren(sourceFile)) {
            if (child.getChildren().length === 0 && child.getText().length > 0) {
                tokens.push(child.getText());
            }
            visit(child);
        }
        return node;
    }
    typescript_1.default.visitNode(sourceFile, visit);
    //console.log(tokens);
    return;
}
function setInitialTokens(file_name) {
    project = incrementalCompile("/Users/karanmehta/UCD/GSR GitHobbit/auto/test");
    program = project.getProgram();
    var sourcefile = program.getSourceFile(file_name);
    create_word_indexes(sourcefile);
    console.log(tokens_at_start);
    //console.log(parsed);
}
var document_position = null;
var filename = "src/test/test-this.js";
var contents = readfile(filename);
async function ast(file_name) {
    try {
        //console.log(initial_tokens);
        for (let idx = 0; idx < tokens_at_start.length; idx++) {
            project = incrementalCompile("/Users/karanmehta/UCD/GSR GitHobbit/auto/test");
            program = project.getProgram();
            var sourcefile = program.getSourceFile(file_name);
            //console.log(sourcefile);
            //console.log("file :" + file_name + " " + "sourcefile :" + sourcefile);
            let checker = program.getTypeChecker();
            var word_of_interest = tokens_at_start[0];
            document_position = tokens_at_start[1];
            let tokens_and_inferred = fast_linter(checker, sourcefile, document_position, word_of_interest);
            var tokens = tokens_and_inferred[0];
            var inferred_type = tokens_and_inferred[1];
            //console.log("INFERRED TYPE: " + inferred_type);
            var word_index = tokens_and_inferred[2];
            //console.log("For word: " + initial_tokens[idx].value + " WORD INDEX: " + word_index + " document position: " + document_position + " map position: " + it.get(initial_tokens[idx].value));
            if (inferred_type && word_index) {
                let data = await getTypeSuggestions(JSON.stringify(tokens), word_index);
                //console.log(data);
                complete_list_of_types = getTypes(inferred_type, data);
                contents = insert(sourcefile, complete_list_of_types[0], word_index, word_of_interest);
                //console.log(contents);
                file_name = changeExtension(file_name);
                writeToFile(file_name, contents);
            }
            else {
                //console.log("Could not infer type for: ", initial_tokens[idx]);
                couldNotInfer++;
            }
        }
    }
    catch (e) {
        console.log("Could not process the file");
    }
}
function getTypes(inferred_type, data) {
    complete_list_of_types = [];
    if (inferred_type !== undefined) {
        if (data.type_suggestions[0] === inferred_type) {
            //console.log("Common type: ", inferred_type);
            common++;
        }
        if (data.probabilities[0] >= 0.90) {
            //console.log("Model type: ", data.type_suggestions[0]);
            modelBasedAnalysisTypes++;
            complete_list_of_types = data.type_suggestions.concat([inferred_type]);
        }
        else {
            //console.log("Static type: ", inferred_type);
            staticAnalysisTypes++;
            complete_list_of_types = [inferred_type].concat(data);
        }
    }
    else {
        //console.log("Inferred is null: ", data.type_suggestions[0]);
        modelBasedAnalysisTypes++;
        complete_list_of_types = data.type_suggestions;
    }
    return complete_list_of_types;
}
function changeExtension(name) {
    var new_file_name = name;
    var extension = name.split(".").pop();
    if (extension === "js") {
        let splitter = name.split(".");
        splitter[splitter.length - 1] = "ts";
        new_file_name = "";
        for (let i = 0; i < splitter.length; i++) {
            new_file_name += i !== splitter.length - 1 ? splitter[i] + "." : splitter[i];
        }
    }
    return new_file_name;
}
function writeToFile(destinationFilePath, textToWrite) {
    (0, fs_1.writeFileSync)(destinationFilePath, textToWrite);
}
function checkElement(element, idx, parsed) {
    if (element.type !== "Identifier" || importSet.has(element.value)) {
        return false;
    }
    //console.log(parsed[idx].value, " " , parsed[idx + 2].value);
    if (idx + 2 < parsed.length && parsed[idx + 2].value === "require") {
        importSet.add(parsed[idx].value);
        return false;
    }
    // Handling console.log -- TO DO Handle for different types of statements?
    // if (element.value === "console" || tokens[idx + 1] === "." || tokens[idx + 2] === "log") {
    //     return false;
    // }
    return true;
}
function incrementalCompile(dir) {
    const configPath = typescript_1.default.findConfigFile(dir, typescript_1.default.sys.fileExists, "tsconfig.json");
    if (configPath) {
        const host = typescript_1.default.sys;
        const config = typescript_1.default.getParsedCommandLineOfConfigFile(configPath, { incremental: true }, host);
        var project = typescript_1.default.createIncrementalProgram({
            rootNames: config.fileNames,
            options: config.options,
            configFileParsingDiagnostics: typescript_1.default.getConfigFileParsingDiagnostics(config),
            projectReferences: config.projectReferences
        });
        return project;
    }
}
async function getTypeSuggestions(tokens, word_index) {
    try {
        var params = { input_string: tokens, word_index: word_index };
        const response = await (0, node_fetch_1.default)('http://localhost:' + PORT_NUM + '/suggest-types?', { method: 'POST', body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } });
        let data = await response.json();
        //console.log(data);
        return data;
    }
    catch (e) {
        console.log("Could not get response from server for word_index: " + word_index);
    }
}
function getType(deeplearnerType) {
    let source = `var t: ` + deeplearnerType + ` = null;`;
    const sourceFile = typescript_1.default.createSourceFile('test.ts', source, typescript_1.default.ScriptTarget.ES2015, true, typescript_1.default.ScriptKind.TS);
    return sourceFile.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[1].getChildren()[0]["type"];
}
function insert(sourceFile, type, loc, word) {
    var quickReturn = false;
    var match_identifier = false;
    const transformer = (context) => (rootNode) => {
        function visit(node) {
            if (quickReturn || match_identifier) {
                return node;
            }
            for (var child of node.getChildren(sourceFile)) {
                visit(child);
            }
            if (node.kind === typescript_1.default.SyntaxKind.Identifier) {
                if (node.getText() === word && (node.pos < loc + 20 && node.pos > loc - 20)) {
                    match_identifier = true;
                }
            }
            else if (match_identifier && (node.kind === typescript_1.default.SyntaxKind.FunctionDeclaration || node.kind === typescript_1.default.SyntaxKind.MethodDeclaration)) {
                node["type"] = getType(type);
                quickReturn = true;
                match_identifier = false;
            }
            else if (match_identifier && (node.kind === typescript_1.default.SyntaxKind.VariableDeclaration || node.kind === typescript_1.default.SyntaxKind.Parameter)) {
                node["type"] = getType(type);
                quickReturn = true;
                match_identifier = false;
            }
            return node;
        }
        return typescript_1.default.visitNode(rootNode, visit);
    };
    const result = typescript_1.default.transform(sourceFile, [transformer]);
    const transformedSourceFile = result.transformed[0];
    const printer = typescript_1.default.createPrinter();
    return printer.printFile(transformedSourceFile);
}
// calling the methods
setInitialTokens(filename);
ast(filename).then(function (response) {
    console.log("Could not infer: ", couldNotInfer);
    console.log("Inferred from static Analysis: ", staticAnalysisTypes);
    console.log("Inferred from model based analysis: ", modelBasedAnalysisTypes);
    console.log("Common between model and static based anaylsis: ", common);
});
//save the entire file here