import read from 'fs-readdir-recursive';
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'fs';
import * as es from 'esprima';
import fetch from 'node-fetch';

const PORT_NUM = 9090;
var project = null;
var program = null;
var complete_list_of_types = [];
var totalStaticInferences = 0;
var totalDeepLearnerInferences = 0;
var staticAnalysisTypes = 0;
var modelBasedAnalysisTypes = 0;
var common = 0;
var couldNotInfer = 0;
let importSet = new Set();
importSet.add("require");
let basicTypes = new Map<ts.SyntaxKind, string>();
basicTypes.set(ts.SyntaxKind.BooleanKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.BooleanKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.TrueKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.FalseKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.NumberKeyword, "number");
basicTypes.set(ts.SyntaxKind.StringKeyword, "string");
basicTypes.set(ts.SyntaxKind.SymbolKeyword, "symbol");
basicTypes.set(ts.SyntaxKind.EnumKeyword, "enum");
basicTypes.set(ts.SyntaxKind.VoidKeyword, "void");
basicTypes.set(ts.SyntaxKind.ObjectKeyword, "object");
basicTypes.set(ts.SyntaxKind.BigIntKeyword, "bigint");
basicTypes.set(ts.SyntaxKind.UndefinedKeyword, "undefined");
basicTypes.set(ts.SyntaxKind.NullKeyword, "null");
let ignoredTypes = new Set<ts.SyntaxKind>();
ignoredTypes.add(ts.SyntaxKind.MappedType);
ignoredTypes.add(ts.SyntaxKind.ConditionalType);
ignoredTypes.add(ts.SyntaxKind.ThisType);
ignoredTypes.add(ts.SyntaxKind.UnknownKeyword);
ignoredTypes.add(ts.SyntaxKind.IndexedAccessType);
ignoredTypes.add(ts.SyntaxKind.UndefinedKeyword);
ignoredTypes.add(ts.SyntaxKind.NeverKeyword);
ignoredTypes.add(ts.SyntaxKind.TypeOperator);
// ignoredTypes.add(ts.SyntaxKind.NullKeyword);
ignoredTypes.add(ts.SyntaxKind.IntersectionType);
ignoredTypes.add(ts.SyntaxKind.TypeQuery);
const filteredFiles = read(__dirname).filter(item => item.endsWith(".js"));

var proj = null;
function readfile(fileName: string): any {
    return readFileSync(fileName, 'utf-8');
}
function parseEntityName(n: ts.EntityName): string {
    if (n.kind === ts.SyntaxKind.Identifier) {
        return n.text;
    }
    else {
        return parseEntityName(n.left) + "." + n.right.text;
    }
}
function parseType(node: any) {
    var type: any = undefined;
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
        return "any";
    }
    else if (ts.isTypeReferenceNode(node)) {
        let n = node as ts.TypeReferenceNode;
        type = parseEntityName(n.typeName);
    }
    else if (basicTypes.has(node.kind)) {
        type = basicTypes.get(node.kind);
    }
    else if (node.kind === ts.SyntaxKind.ArrayType) {
        type = "array";
    }
    else if (node.kind === ts.SyntaxKind.TypeLiteral) {
        let n = node as ts.TypeLiteralNode;
        return "object";
    }
    else if (node.kind === ts.SyntaxKind.FunctionType || node.kind === ts.SyntaxKind.ConstructorType) {
        let n = node as ts.FunctionOrConstructorTypeNode;
        let ret = parseType(n.type);
        type = ret;
    }
    else if (node.kind === ts.SyntaxKind.UnionType) {
        let n = node as ts.UnionTypeNode;
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
    else if (node.kind === ts.SyntaxKind.LiteralType) {
        let n = node as ts.LiteralTypeNode;
        switch (n.literal.kind) {
            case ts.SyntaxKind.StringLiteral:
                return "string";
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
                return "boolean";
            case ts.SyntaxKind.NumericLiteral:
                return "number";
            case ts.SyntaxKind.NullKeyword:
                return "null";
            default:
                return "any";
        }
    }
    else if (node.kind === ts.SyntaxKind.ParenthesizedType) {
        let n = node as ts.ParenthesizedTypeNode;
        return parseType(n.type);
    }
    else if (node.kind === ts.SyntaxKind.FirstTypeNode || node.kind === ts.SyntaxKind.LastTypeNode) {
        type = "boolean";
    }
    else if (node.kind === ts.SyntaxKind.TupleType) {
        type = "array";
    }
    else {
        type = "any";
    }
    return type;
}

function fast_linter(checker: ts.TypeChecker, sourceFile: ts.SourceFile, loc, word) {
    var tokens: any = [];
    var inferred_type = undefined;
    var word_index: any = undefined;
    var typeCache = undefined;
    function visit(node: ts.Node): ts.Node {
        if (node.kind === ts.SyntaxKind.Identifier) {
            if (node.getText() === word && (node.pos < loc + 20 && node.pos > loc - 20)) {
                word_index = tokens.length - 1;
                inferred_type = typeCache;
            }
        }
        else if (node.kind === ts.SyntaxKind.VariableDeclaration || (node.kind === ts.SyntaxKind.Parameter && node.parent.kind !== ts.SyntaxKind.FunctionType) || node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.MethodDeclaration) {
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
        ts.visitNode(sourceFile, visit);
        return [tokens, inferred_type, word_index];
    }
}

var initial_tokens = [];
function setInitialTokens(file_name: string) {
    var contents = readfile(file_name);
    let parsed = es.parseScript(contents, { range: true, tokens: true});
    console.log(parsed);
    for (let i = 0; i < parsed.tokens.length; i++) {
        if (checkElement(parsed.tokens[i], i, parsed.tokens)) {
            initial_tokens.push(parsed.tokens[i]);
        }
    }
    console.log(initial_tokens);
    console.log("Total tokens: ", initial_tokens.length);
}

var document_position = null;
var filename = "src/test/test-this.js";
var contents = readfile(filename);

async function ast(file_name: string) {
    try {
        for (let idx = 0; idx < initial_tokens.length; idx++) {
            project = incrementalCompile("/Users/karanmehta/UCD/GSR GitHobbit/auto/test");
            program = project.getProgram();
            var sourcefile = program.getSourceFile(file_name);
            //console.log(sourcefile);
            let checker = program.getTypeChecker();
            var word_of_interest = initial_tokens[idx].value;
            document_position = initial_tokens[idx].range[0]; 
            
            let tokens_and_inferred = fast_linter(checker, sourcefile, document_position, word_of_interest);
            var tokens = tokens_and_inferred[0];
            var inferred_type = tokens_and_inferred[1];
            console.log("INFERRED TYPE: " + inferred_type);
            var word_index = tokens_and_inferred[2];
            console.log(" WORD INDEX: " + word_index);

            if (inferred_type && word_index) {
                let data = await getTypeSuggestions(JSON.stringify(tokens), word_index);
                complete_list_of_types = getTypes(inferred_type, data);
                contents = insert(sourcefile, complete_list_of_types[0], document_position, word_of_interest);
                file_name = changeExtension(file_name);
                writeToFile(file_name, contents);
            } else {
                console.log("Could not infer type for: ", initial_tokens[idx]);
                couldNotInfer++;
            }
        }
    } catch (e) {
        console.log("Could not process the file");
    }
}

function getTypes(inferred_type: any, data: { probabilities: number[]; type_suggestions: any[]; }) {
    complete_list_of_types = [];
    if (data != undefined) {
        totalDeepLearnerInferences++;
    }
    if (inferred_type !== undefined) {
        totalStaticInferences++;
        if (data.type_suggestions[0] === inferred_type) {
            common++;
        }
        if (data.probabilities[0] >= 0.90) {
            modelBasedAnalysisTypes++;
            complete_list_of_types = data.type_suggestions.concat([inferred_type]);
        } else {
            staticAnalysisTypes++;
            complete_list_of_types = [inferred_type].concat(data);
        }
    } else {
        modelBasedAnalysisTypes++;
        complete_list_of_types = data.type_suggestions;
    }
    return complete_list_of_types;
}

function changeExtension(name: string): string {
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

function writeToFile(destinationFilePath: string, textToWrite: string) {
    writeFileSync(destinationFilePath, textToWrite);
}

function checkElement(element: any, idx: number, parsed: any) : boolean {
    if (element.type !== "Identifier" || importSet.has(element.value)) {
        return false;
    }

    // check for import statements. e.g const fs = require('fs');
    if (idx + 2 < parsed.length && parsed[idx + 1].value === "=" && parsed[idx + 2].value === "require") {
        console.log("element rejected", element.value);
        importSet.add(element.value);
        return false;
    }

    //// checking for functions being used from an import. eg fs.readFileSync
    // if (idx - 2 >= 0 && parsed[idx - 1].value === "." && importSet.has(parsed[idx - 2].value)) {
    //     console.log("element rejected", element.value);
    //     importSet.add(element.value);
    //     return false;
    // }

    if (element.value === "console" && parsed[idx + 1].value === "." && parsed[idx + 2].value === "log") {
        return false;
    }
    return true;
}

function incrementalCompile(dir: string): any {
    const configPath = ts.findConfigFile(dir, ts.sys.fileExists, "tsconfig.json");
    if (configPath) {
        const host: ts.ParseConfigFileHost = ts.sys as any;
        const config: any = ts.getParsedCommandLineOfConfigFile(configPath, { incremental: true }, host);
        var project = ts.createIncrementalProgram({
            rootNames: config.fileNames,
            options: config.options,
            configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(config),
            projectReferences: config.projectReferences
        });
        return project;
    }
}

async function getTypeSuggestions(tokens: any, word_index: any) : Promise<any>{
    try {
        var params = { input_string: tokens, word_index: word_index };
        const response = await fetch('http://localhost:' + PORT_NUM + '/suggest-types?', { method: 'POST', body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } });
        let data = await response.json();
        return data;
    } catch (e) {
        console.log("Could not get response from server for word_index: " + word_index)
    }
}

function getType(deeplearnerType: string) {
    let source = `var t: ` + deeplearnerType + ` = null;`;
    const sourceFile: ts.SourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
    return sourceFile.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[1].getChildren()[0]["type"];
}

function insert(sourceFile: ts.SourceFile, type: string, loc: number, word: string): any {
    var quickReturn = false;
    var match_identifier = false;
    
    const transformer = <T extends ts.Node>(context: ts.TransformationContext) => (rootNode: T) => {
        function visit(node: ts.Node): ts.Node {
            if (quickReturn || match_identifier) {
                return node;
            }
            for (var child of node.getChildren(sourceFile)) {
                visit(child);
            }
            if (node.kind === ts.SyntaxKind.Identifier) {
                if (node.getText() === word && (node.pos < loc + 20 && node.pos > loc - 20)) {
                    match_identifier = true;
                }
            }
            else if (match_identifier && (node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.MethodDeclaration)) {
                node["type"] = getType(type);
                quickReturn = true;
                match_identifier = false;
            }
            else if (match_identifier && (node.kind === ts.SyntaxKind.VariableDeclaration || node.kind === ts.SyntaxKind.Parameter)) {
                node["type"] = getType(type);
                quickReturn = true;
                match_identifier = false;
            }
            return node;
        }
        return ts.visitNode(rootNode, visit);
    };
    const result: ts.TransformationResult<ts.SourceFile> = ts.transform<ts.SourceFile>(sourceFile, [transformer]);
    const transformedSourceFile: ts.SourceFile = result.transformed[0];
    const printer: ts.Printer = ts.createPrinter();
    return printer.printFile(transformedSourceFile);
}

// calling the methods
setInitialTokens(filename);
ast(filename).then(() => {
    console.log("Could not infer: ", couldNotInfer);
    console.log("Total Static Analysis Inferences: ", totalStaticInferences);
    console.log("Total Deep Learner Inferences: ", totalDeepLearnerInferences);
    console.log("Selected from static Analysis: ", staticAnalysisTypes);
    console.log("Selected from model based analysis: ", modelBasedAnalysisTypes);
    console.log("Common selections from Static Analysis and Deep Learner: ", common);
});