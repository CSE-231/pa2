import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {Expr, Stmt, BinaryOp, Type, TypedVar, VarDefs, Literal, Program, FunDefs} from "./ast";
import { stringifyTree } from "./treeprinter";

const stmts:Stmt<null>[] = [];
const varDefs:VarDefs<null>[] = [];
const funDefs:FunDefs<null>[] = [];

function isVarDecl(c: TreeCursor, s: string) : Boolean {
  if (c.type.name !== "AssignStatement")
    return false;
  c.firstChild();
  c.nextSibling();
  const name = c.type.name;
  c.parent();
  // @ts-ignore
  if (name !== "TypeDef")
    return false;
  return true;
} 

function isFunDef(c: TreeCursor, s: string) : Boolean {
  return c.type.name === "FunctionDefinition"
}

export function traverseType(c : TreeCursor, s: string) : Type {
  switch(s.substring(c.from, c.to)) {
    case "int": 
      return Type.int;
    case "bool": 
      return Type.bool;
    case "None": 
      return Type.none;  
  }
}

export function traverseTypedVar(c : TreeCursor, s: string) : TypedVar<null> {
  const name = s.substring(c.from, c.to);
  c.nextSibling(); // TypeDef parse
  c.firstChild(); // :
  c.nextSibling(); // type
  const type = traverseType(c, s);
  c.parent();
  return {name, type};
}

export function traverseLiteral(c: TreeCursor, s: string) : Literal<null> {
  switch(c.type.name) {
    case "Number":
      return {tag: "num", value: Number(s.substring(c.from, c.to))};
    case "Boolean":
      return {tag: "bool", value: Boolean(s.substring(c.from, c.to))};
    case "None":
      return {tag: "none"}
    default:
      throw new Error("PARSE ERROR : Unexpected Literal Type");
  }
}

export function traverseVarDefs(c : TreeCursor, s: string) : VarDefs<null> {
  c.firstChild(); //name
  const {name, type} = traverseTypedVar(c, s);
  c.nextSibling(); //AssignOp
  c.nextSibling(); //value
  const init = traverseLiteral(c, s);
  c.parent();
  return {name, type, literal: init};
}

export function traverseFunDefs(c : TreeCursor, s: string) : FunDefs<null> {
  c.firstChild(); //def
  c.nextSibling();
  const fname = s.substring(c.from, c.to); // function name
  c.nextSibling(); // Param List
  c.firstChild(); // open paranthesis
  c.nextSibling() // go to either first param or )
  const params : TypedVar<null>[] = [];
  do {
    if (c.type.name === ")")
      break;
    //TODO : double check ,  
    if (c.type.name === ",")
      continue;
    params.push(traverseTypedVar(c, s));
  } while (c.nextSibling())
  c.parent(); // come out of params
  c.nextSibling(); // typeDef for return type

  var returnType = Type.none
  if (c.type.name === "TypeDef") {
    c.firstChild(); // go into return type
    //TODO : double check here if we need a nextSibling call
    returnType = traverseType(c, s)
    c.parent();
  }

  c.nextSibling(); //body parse
  c.nextSibling(); //:
  c.nextSibling(); // first stmt

  const varInits : VarDefs<null>[] = [];
  const bodyStmts : Stmt<null>[] = [];

  do {
    if (isVarDecl(c, s)) {
      varInits.push(traverseVarDefs(c, s));
    } else if (isFunDef(c, s)) {
      throw new Error("PARSE ERROR : Nested functions not supported");
    } else {
      break;
    }
  } while(c.nextSibling())

  do {
    if (isFunDef(c,s) || isVarDecl(c,s)) {
      throw new Error("PARSE ERROR : variable and function definitions should be before statments");
    } 
    bodyStmts.push(traverseStmt(c, s));
  } while(c.nextSibling())

  c.parent(); // pop to body
  c.parent(); // pop to fn def

  if (returnType === Type.none)
    bodyStmts.push({tag : "return", value : {tag : "literal", literal : {tag: "none"}}}) // for empty return 
  
  return {name : fname, params, ret : returnType, body1: varInits, body2 : bodyStmts}
}

export function traverseExpr(c : TreeCursor, s : string) : Expr<null> {
  switch(c.type.name) {

    case "Number":
      return {
        tag : "literal",
        literal: traverseLiteral(c,s)
      }

    case "Boolean":
      return {
        tag : "literal",
        literal: traverseLiteral(c,s)
      }

    case "None":
      return {
        tag : "literal",
        literal: traverseLiteral(c,s)
      }

    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }

    case "CallExpression":
      c.firstChild(); // go to name
      const callName = s.substring(c.from, c.to);
      c.nextSibling(); // go to arglist
      var args = traverseArgs(c, s);

      if (callName === "abs") {
        if (args.length === 1) {
          c.parent();
          return {
            tag: "builtin1",
            name: callName,
            arg: args[0]
          };
        } else {throw new Error("PARSE ERROR: unknown builtin1")}
      } else if (callName === "max" || callName === "min" || callName === "pow") {
        if (args.length === 2) {
          c.parent();
          return {
            tag: "builtin2",
            name: callName,
            arg1: args[0],
            arg2: args[1]
          };
        } else {throw new Error("PARSE ERROR: unknown builtin2")}
      } else {
        //TODO : Should we handle print separately ?
        c.parent();
        return {
          tag : "call",
          name : callName,
          args: args
        }
      }

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

    case "ParenthesizedExpression":
      c.firstChild(); // go to (
      c.nextSibling(); // go to Expr
      const expr = traverseExpr(c,s);
      c.parent();
      return expr;


    case "BinaryExpression":
      c.firstChild();
      const leftarg = traverseExpr(c, s); 
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
        case "//":
          operator = BinaryOp.D_slash;
          break;
        case "%":
          operator = BinaryOp.Mod;
          break;
        case ">":
          operator = BinaryOp.Gt;
          break;
        case "<":
          operator = BinaryOp.Lt;
          break;
        case "<=":
          operator = BinaryOp.Leq;
          break;
        case ">=":
          operator = BinaryOp.Geq;
          break;
        case "==":
          operator = BinaryOp.Eq;
          break;
        case "!=":
          operator = BinaryOp.Neq;
          break;
        case "is":
          operator = BinaryOp.Is;
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

export function castForUnary() : Expr<null> {
  return {
    tag: "literal",
    literal : {tag: "num", value: Number("0")}
  }
}

export function traverseArgs(c: TreeCursor, s: string) : Array<Expr<null>> {
  var args : Array<Expr<null>> = [];
  c.firstChild(); // go into arglist
  while(c.nextSibling()) { // is this right ?
      args.push(traverseExpr(c, s))
      c.nextSibling();
  }
  c.parent(); // pop arglist
  return args;
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt<null> {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "assign",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }

    case "PassStatement":
      return {tag : "pass"}

    case "ReturnStatement":
      c.firstChild(); //return tag
      c.nextSibling();
      const val = traverseExpr(c, s);
      c.parent();
      return {tag : "return", value: val}
    
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Program<null> {
  switch(c.node.type.name) {
    case "Script":
      c.firstChild();
      //Parse vars and fns first
      do {
        if (isVarDecl(c, s)) {
          varDefs.push(traverseVarDefs(c,s));
        } else if (isFunDef(c, s)) {
          funDefs.push(traverseFunDefs(c,s));
        } else {
          break;
        }
        if (c.nextSibling()) {
          continue;
        } else {
          return {varDefs, funDefs, stmts};
        }
      } while(true)

      // Parse statements next
      do {
        if (isVarDecl(c, s) || isFunDef(c, s)) {
          throw new Error("PARSE ERROR : Variable or Function definition encountered while parsing statements");
        } else {
          stmts.push(traverseStmt(c,s));
        }
      } while(c.nextSibling())
      return {varDefs, funDefs, stmts}
    
      default:
        throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}

export function parse(source : string) : Program<null> {
  const t = parser.parse(source);
  const strTree = stringifyTree(t.cursor(), source, 0);
  if (strTree == "Script\n")
    throw new Error("PARSE ERROR : Empty input or program");
  console.log(strTree);
  return traverse(t.cursor(), source);
}
