import { parse } from "./parser";

var ast = parse("def f(x : int): { return x }");
console.log(ast);