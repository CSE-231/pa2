import { compile } from "./compiler";
import { parse } from "./parser";

var output = compile("x:int = 2\n x = x + 6");
console.log(output);
console.log("hello");