import { parse } from "./parser";

var ast = parse("abs(1)");
console.log(ast);