import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {Expr, Stmt, BinaryOp} from "./ast";
import { stringifyTree } from "./treeprinter";

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }

    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }

    case "CallExpression":
      c.firstChild();
      const callName = s.substring(c.from, c.to);
      c.nextSibling(); // go to arglist
      var args = traverseArgs(c, s);
      if (args.length == 1) {
        if (callName !== "abs" && callName !== "print")
          throw new Error("PARSE ERROR: unknown builtin1")
        c.parent(); // pop CallExpression
        return {
            tag: "builtin1",
            name: callName,
            arg: args[0]
        };
      } else if (args.length == 2) {
        if (callName !== "max" && callName !== "min" && callName !== "pow")
          throw new Error("PARSE ERROR: unknown builtin2")
        c.parent(); // pop CallExpression
        return {
            tag: "builtin2",
            name: callName,
            arg1: args[0],
            arg2: args[1]
        };
      }
      throw new Error("PARSE ERROR: unknown builtin")

    case "UnaryExpression":
      c.firstChild();
      var optr : BinaryOp;
      switch(s.substring(c.from, c.to)) {
        case "+":
          optr = BinaryOp.Plus;
          break;
        case "-":
          optr = BinaryOp.Minus;
          break;
        default: 
          throw new Error("PARSE ERROR: unknown unary operator")
      }

      c.nextSibling();
      const rtarg = traverseExpr(c, s);
      c.parent();

      return {
        tag: "binExpr",
        left: castForUnary(),
        op: optr,
        right: rtarg
      } 

    case "BinaryExpression":
      c.firstChild();
      const leftarg = traverseExpr(c, s); //TODO :  why not substring here ?
      c.nextSibling();

      var operator : BinaryOp;
      switch(s.substring(c.from, c.to)) {
        case "+":
          operator = BinaryOp.Plus;
          break;
        case "-":
          operator = BinaryOp.Minus;
          break;
        case "*":
          operator = BinaryOp.Mul;
          break;
        default: 
          throw new Error("PARSE ERROR: unknown binary operator");
      }
      c.nextSibling();
      const rightarg = traverseExpr(c, s);
      c.parent();
      return {
        tag: "binExpr",
        left: leftarg,
        op: operator,
        right: rightarg
      }


    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function castForUnary() : Expr {
  return {
    tag: "num",
    value: Number("0")
  }
}

export function traverseArgs(c: TreeCursor, s: string) :Array<Expr> {
  var args : Array<Expr> = [];
  c.firstChild(); // go into arglist
  while(c.nextSibling()) { // is this right ?
      args.push(traverseExpr(c, s))
      c.nextSibling();
  }
  c.parent(); // pop arglist
  return args;
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "define",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      console.log("traversed " + stmts.length + " statements ", stmts, "stopped at " , c.node);
      return stmts;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}

export function parse(source : string) : Array<Stmt> {
  const t = parser.parse(source);
  const strTree = stringifyTree(t.cursor(), source, 0);
  if (strTree == "Script\n")
    throw new Error("PARSE ERROR : Empty input or program");
  console.log(strTree);
  return traverse(t.cursor(), source);
}
