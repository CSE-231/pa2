
export enum Type {int, bool, none}

export type Program<A> = 
  | {a?: A, varDefs: VarDefs<A>[], funDefs: FunDefs<A>[], stmts: Stmt<A>[]}

export type FunDefs<A> = 
  { a?: A, name: String, params : TypedVar<A>[], ret : Type, body1 : VarDefs<A>[], body2 : Stmt<A>[]}

export type VarDefs<A> = 
  {a?: A, typedVar: TypedVar<A>, literal: Literal<A>}

export type TypedVar<A> = 
  {a?: A, name: string, type: Type}

export type Literal<A> = 
    {a?: A, tag : "num", value: number}
  | {a?: A, tag : "bool", value: boolean}
  | {a?: A, tag : "none"}

export type Stmt<A> =
//    {a?: A, tag: "define", name: string, params: Parameter[], ret: Type, body: Stmt<A>[]}
  | {a?: A, tag: "expr", expr: Expr<A>}
  | {a?: A, tag: "return", value: Expr<A>}
  | { a?: A, tag: "pass" }
  | {a?: A, tag: "assign", name: string, value: Expr<A>}

export type Parameter =
  | { name: string, typ: Type }

export type Expr<A> =
    {a?: A, tag: "num", value: number}
  | {a?: A, tag: "literal", literal: Literal<A>} 
  | {a?: A, tag: "id", name: string}
  | {a?: A, tag: "unExpr", op: UnaryOp, right: Expr<A>} 
  | {a?: A, tag: "binExpr", left: Expr<A>, op: BinaryOp, right: Expr<A>} 
  | {a?: A, tag: "builtin1", name: string, arg: Expr<A>}
  | {a?: A, tag: "builtin2", name: string, arg1: Expr<A>, arg2: Expr<A>}
  | { a?: A, tag: "call", name: string, args: Expr<A>[] }

export enum UnaryOp {Not = "NOT", U_Minus = "U_MINUS"}

export enum BinaryOp {Plus = "PLUS", Minus = "MINUS", Mul = "MUL"}
