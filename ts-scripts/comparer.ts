import * as ts from 'typescript';
import TreeMap from 'ts-treemap'
import { match } from 'assert';

const jsFile = "/Users/karanmehta/Downloads/files-2/files/ribbon/dex.js";
const tsFile = "/Users/karanmehta/Downloads/files-2/files/ribbon/dex.ts";

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

function getAllTokens(file_name : string, program: ts.Program) {
    let tokens = new TreeMap<number, string>()
    var sourcefile : ts.SourceFile = program.getSourceFile(file_name);
    
    function nodeChecker(node: ts.Node) {
        
        tokens.set(node.pos, node.getText(sourcefile));
        
        for (var child of node.getChildren(sourcefile)) {
            nodeChecker(child);
        }
        return node;
    }

    ts.visitNode(sourcefile, nodeChecker);
    return tokens;
}

function getTypesFromTypeScript(checker: ts.TypeChecker, sourceFile: ts.SourceFile) {
    var tokens: any = [];
    var typeCache = undefined;
    function visit(node: ts.Node): ts.Node {
        if (node.kind === ts.SyntaxKind.VariableDeclaration || (node.kind === ts.SyntaxKind.Parameter && node.parent.kind !== ts.SyntaxKind.FunctionType) || node.kind === ts.SyntaxKind.FunctionDeclaration) {
            if (node.hasOwnProperty('name')) {
                let symbol = checker.getSymbolAtLocation(node['name']);
                if (symbol) {
                    const ty = checker.getTypeAtLocation(node);
                    const n = checker.typeToTypeNode(ty, undefined, undefined);
                    typeCache = parseType(n);
                    tokens.push([node.getText().split(":")[0].split("=")[0].trim(), typeCache, node.pos]);
                }  
            }
        }
        for (var child of node.getChildren(sourceFile)) {
            visit(child);
        }
        return node;
    }
    ts.visitNode(sourceFile, visit);
    return tokens;
}
function identifyTokens(sourcefile: ts.SourceFile) {
    let tokens : any = [];
    function nodeChecker(node: ts.Node) {
        if (!ts.isImportDeclaration(node) && node.kind == ts.SyntaxKind.Identifier) {

            //console.log("NEW NODE" + node.getText(sourcefile) + "\n")
            tokens.push([node.getText(sourcefile), node.pos])
            // if (ts.isVariableDeclaration(node)) {
            //     var txt = node.name?.text;
            //     tokens.push([txt, parseType(node), node.pos])
                
            // } else if (node.kind == ts.SyntaxKind.MethodDeclaration) {
            //     //console.log(node)
            //     var method = <ts.MethodDeclaration>node;
            //     for (let i = 0; i < method.parameters.length; i++) {
            //         var name = method.parameters[i].name
            //         var type = ts.SyntaxKind[method.parameters[i].type?.kind]
            //         if (type !== "TypeReference") {
            //             tokens.push([name?.text, type, node.pos])
            //         } else {
            //             tokens.push([name?.text, method.parameters[i].type?.typeName?.escapedText, node.pos])
            //         }
            //     }
            // }
        }
        for (var child of node.getChildren(sourcefile)) {
            nodeChecker(child);
        }
        return node;
    }
    ts.visitNode(sourcefile, nodeChecker);
    return tokens;
}


function compareFile(file1: string, file2: string) {
    //file1 -> ts AND file2 -> js

    let program1 = ts.createProgram([file1],{})
    var srcFile1 : any = program1.getSourceFile(file1)
    var typeChecker1 = program1.getTypeChecker();
    var tokens1 = getTypesFromTypeScript(typeChecker1, srcFile1);
    var allTokens1 : TreeMap<number, string> = getAllTokens(file1, program1);
    
    let program2 = ts.createProgram([file2], {allowJs: true})
    var srcFile2 : any = program2.getSourceFile(file2);
    var tokens2 = identifyTokens(srcFile2);
    var allTokens2 : TreeMap<number, string> = getAllTokens(file2, program2);

    console.log(tokens1)
    console.log(tokens2)
    //console.log(allTokens1)
    var matchedMap = new Map<number, number[]>();
    for (let i = 0; i < tokens1.length; i++) {
        for (let j = 0; j < tokens2.length; j++) {
            if (tokens1[i][0] == tokens2[j][0]) {
                var startx = tokens1[i][2];
                var endx = tokens1[i][2];
                var starty = tokens2[j][1];
                var endy = tokens2[j][1];
                var left_matches = 0;
                console.log(allTokens1.floorEntry(startx), allTokens2.floorEntry(starty))
                while (editDistance(allTokens1.get(startx)?.[1], allTokens2.get(starty)?.[1]) < 10) {
                    left_matches++;
                    startx = allTokens1.floorEntry(startx)[0];
                    starty = allTokens2.floorEntry(starty)[0];
                }
                var right_matches = 0;
                while (editDistance(allTokens1.get(endx)?.[1], allTokens2.get(endy)?.[1]) < 10) {
                    right_matches++;
                    endx = allTokens1.ceilingEntry(endx)[0];
                    endy = allTokens2.ceilingEntry(endy)[0];
                }
                var matches = left_matches + right_matches;
                if (matchedMap.has(i) && matches > matchedMap.get(i)[1]) {
                    matchedMap.set(i, [j, matches]);    
                } else {
                    matchedMap.set(i, [j, matches]);
                }
                
            }
        }
    }
    console.log(matchedMap)


    
    //console.log(nodeList1);
    // FOR JS NODES
    //var nodeList2 : any = []
    // for (let j = 0; j < tokens2.length; j++) {
    //     let node2 = tokens2[j]
    //     let txt = node2.getText(srcFile2).split(" ")
    //     if (txt.length == 1 && node2.kind == ts.SyntaxKind.Identifier) {
    //         nodeList2.push([txt[0], node2.pos, node2])
    //     }
    // }
    //console.log(tokens2)

    // for (let i = 0; i < nodeList1.length; i++) {
    //     var maxMatched : number[] = []
    //     const x = nodeList1[i];
    //     var matched = []
    //     for (let j = 0; j < nodeList2.length; j++) {
    //         let matches = 0
    //         var y = j;
    //         const t1 : string = tsu.getAstNodeAtPosition(srcFile1, x[2] - 1)?.getText(srcFile1)
    //         if (x[0] == y[0]) {
    //             while (
    //                 editDistance(
    //                     t1,
    //                     tsu.getAstNodeAtPosition(srcFile2, nodeList2[y][1] - 1)?.getText(srcFile2))
    //                     > 0.95
    //                 ) {
    //                     matches++;
    //                     y++;
    //                 }
    //         }
    //         matched[]
    //     }

        
    // }
    
    // for (let j = 0; j < tokens2.length; j++) {
    //     let node2 = tokens2[j]
    //     if (node2.getText(srcFile2).split(" ").length == 1 && node2.getText(srcFile2).includes("client")) {
    //         console.log(node2.getText(srcFile2))
    //     }
    //     // if (node2.getText(srcFile2) == "client") {
    //     //     console.log(node2)
    //     // }
    //     // if (node1.getText(srcFile1) == node2.getText(srcFile2)) {
    //     //     fs.appendFileSync("/Users/karanmehta/UCD/auto/githobbit/data.txt", node1.getText(srcFile1) + " " + node2.getText(srcFile2) + " " + node1.kind + " " +node1.pos + " " + node2.pos);
    //     //     matched.push([node1.getText(srcFile1), node2.getText(srcFile2), node1.kind, node1.pos, node2.pos]);
    //     //     break;
    //     // }
    // }

    //console.log(matched);
    // var idx1 : number = 0;
    // var idxList = Array(ast1.length, -1);
    // while (idx1 < ast1.length) {
    //     var arr = Array(ast2.length);
    //     arr[0] = editDistance(ast1[idx1], ast2[0]);
    //     var min = arr[0];
    //     var minIndex = 0;
    //     for (let i = 1; i < arr.length; i++) {
    //         if (ast2[i] !== "" && ast2[i].length <= ast1[idx1].length) {
    //             arr[i] = editDistance(ast1[idx1], ast2[i]);
    //             if (arr[i] < min) {
    //                 min = arr[i];
    //                 minIndex = i
    //             }
    //         }
    //     }
    //     console.log(ast1[idx1], ast2[minIndex])
    //     idxList[idx1] = minIndex;
    //     idx1++;
    // }
}

function min(x: number, y: number, z: number) {
    if (x <= y && x <= z)
            return x;
        if (y <= x && y <= z)
            return y;
        else
            return z;
}
 
function editDistance(str1: string, str2: string) {
    var m : number = str1.length
    var n : number = str2.length
    let dp = new Array(m + 1);
    for(let i = 0; i < m + 1; i++) {
        dp[i] = new Array(n + 1);
        for (let j = 0;j < n + 1; j++) {
            dp[i][j]=0;
        }
    }

    for (let i = 0; i <= m; i++) {
        for (let j = 0; j <= n; j++) {
            if (i == 0)
                dp[i][j] = j;
            else if (j == 0)
                dp[i][j] = i;
            else if (str1[i - 1] == str2[j - 1])
                dp[i][j] = dp[i - 1][j - 1];
            else
                dp[i][j] = min(1 + dp[i][j - 1], 1 + dp[i - 1][j], 1 + dp[i - 1][j - 1]); // 0.1 + dp[i - 1][j] represents deletion penalty is zero
        }
    }

    return dp[m][n];
}

compareFile(tsFile, jsFile)
// console.log(editDistance("run (msg, {pokemon, shines}) {", "public run (msg: CommandoMessage"))
// console.log(editDistance("       ]", "public run (msg: CommandoMessage"))