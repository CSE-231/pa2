import { compile } from "./compiler";
import { parse } from "./parser";

var output = compile("pow(1,2)");
console.log(output);
console.log("hello");