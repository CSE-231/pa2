import { parse } from "./parser";

var ast = parse("x = (6+5)");
console.log(ast);