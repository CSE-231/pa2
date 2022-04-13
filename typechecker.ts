import { BinaryOp, Expr, FunDefs, Literal, Program, Stmt, Type, TypedVar, UnaryOp, VarDefs } from "./ast";

type TypeEnv = {
    vars : Map<string, Type>,
    functions : Map<string, [Type[], Type]>
    retType : Type
}

export function typeCheckExpr(expr : Expr<null>, typeEnv : TypeEnv) : Expr<Type> {
    switch(expr.tag) {
        case "call":
            if (expr.name === "print") {
                if (expr.args.length !== 1) { 
                    throw new Error("print expects a single argument"); 
                }
                const newArgs = [typeCheckExpr(expr.args[0], typeEnv)];
                const res : Expr<Type> = {...expr, a: Type.none, args: newArgs };
                return res;
            }

            if (!typeEnv.functions.has(expr.name)) {
                throw new Error("function ${e.name} not found");
            }
            
            const [args, ret] = typeEnv.functions.get(expr.name);
            if (args.length !== expr.args.length) {
                throw new Error(`Expected ${args.length} arguments but got ${expr.args.length}`);
            }
            
            const newArgs = args.map((a, i) => {
                const argtyp = typeCheckExpr(expr.args[i], typeEnv);
                if(a !== argtyp.a) { throw new Error(`Got ${argtyp} as argument ${i + 1}, expected ${a}`); }
                return argtyp
              });
        
            return {...expr, a: ret, args: newArgs };


        case "num": return {...expr, a: Type.int};
       
        case "literal": 
            const lit = typeCheckLiteral(expr.literal); 
            return {...expr, a: lit.a, literal: lit};

        case "id":
            if (!typeEnv.vars.has(expr.name)) {
                throw new Error("TypeError : unbound id");
            }
            const idType = typeEnv.vars.get(expr.name);
            return {...expr, a:idType};

        case "builtin2":
            const arg1 = typeCheckExpr(expr.arg1, typeEnv);
            const arg2 = typeCheckExpr(expr.arg2, typeEnv);
            if (arg1.a !== Type.int && arg2.a !== Type.int) {
                throw new Error("TypeError : Expression does not evaluate to int");
            }
            return {...expr, a: Type.int, arg1, arg2}; 

        case "builtin1":
            const arg = typeCheckExpr(expr.arg, typeEnv);
            if (arg.a !== Type.int) {
                throw new Error("TypeError : Expression does not evaluate to int");
            }
            return {...expr, a: Type.int, arg}; 
        
        case "binExpr":
            const left = typeCheckExpr(expr.left, typeEnv);
            const right = typeCheckExpr(expr.right, typeEnv);
            switch(expr.op) {
                case BinaryOp.Plus:
                case BinaryOp.Minus:
                case BinaryOp.Mul:
                case BinaryOp.D_slash:
                case BinaryOp.Mod:
                    if (left.a !== Type.int && right.a !== Type.int) {
                        throw new Error("TypeError : Expression does not evaluate to int");
                    }
                    return {...expr, a: Type.int, left, right}; 
                
                case BinaryOp.Leq:
                case BinaryOp.Geq:
                case BinaryOp.Gt:
                case BinaryOp.Lt:    
                    if (left.a !== Type.int && right.a !== Type.int) {
                        throw new Error("TypeError : Expression does not evaluate to int");
                    }
                    return {...expr, a: Type.bool, left, right}; 

                case BinaryOp.Eq:
                case BinaryOp.Neq:
                    if (left.a == Type.int && right.a == Type.int) {
                        // returning bool as we are checking equals 
                        return {...expr, a: Type.bool, left, right}; 
                    }
                    
                    if (left.a == Type.bool && right.a == Type.bool) {
                        return {...expr, a: Type.bool, left, right}; 
                    }

                    // Do we have to handle None also here ?
                    throw new Error("TypeError : LHS and RHS do not evaluate to the same types");

                case BinaryOp.Is:
                    //check none and return boolean

                default:
                    throw new Error(`Unhandled op ${expr.op}`)
            }

        case "unExpr":
            const rt = typeCheckExpr(expr.right, typeEnv);
            switch(expr.op) {
                case UnaryOp.Not:
                    if (rt.a !== Type.bool) {
                        throw new Error("TypeError : Expression does not evaluate to bool");
                    } 
                    return {...expr, a: Type.bool, right:rt};
                case UnaryOp.U_Minus:
                    if (rt.a !== Type.int) {
                        throw new Error("TypeError : Expression does not evaluate to int");
                    } 
                    return {...expr, a: Type.int, right:rt};
            }
    }
}

export function typeCheckLiteral(literal : Literal<null>) : Literal<Type> {
    switch(literal.tag) {
        case "num": return {...literal, a: Type.int};
        case "bool": return {...literal, a: Type.bool};
        case "none": return {...literal, a: Type.none};
    }
}

export function typeCheckVarDefs(defs: VarDefs<null>[], typeEnv: TypeEnv) : VarDefs<Type>[] {
    const typedVarDefs : VarDefs<Type>[] = [];
    defs.forEach(def => {
        const typedDef = typeCheckLiteral(def.literal);
        if (typedDef.a !== def.type) {
            throw new Error("TypeError : Variable definition does not have consistent types");
        }
        typedVarDefs.push({...def, a: def.type, literal : typedDef});
        typeEnv.vars.set(def.name, def.type);
    });

    return typedVarDefs;
}

export function typeCheckTypedVars(vars: TypedVar<null>[]) : TypedVar<Type>[] {
    return vars.map(variable => {
        return {...variable, a: variable.type}
    });
}

function duplicateEnv(env : TypeEnv) : TypeEnv {
    return  { vars : new Map(env.vars), functions : new Map(env.functions), retType : env.retType}
}

export function typeCheckFunDef(fndef: FunDefs<null>, typeEnv : TypeEnv) : FunDefs<Type> {
    const localEnv = duplicateEnv(typeEnv);
    const typedParams = typeCheckTypedVars(fndef.params);
    fndef.params.forEach(p => {
        localEnv.vars.set(p.name, p.type);
    });

    //TODO :  Double check if we need to add it to global env
    const typedVarDefs = typeCheckVarDefs(fndef.body1, localEnv);

    //Add function to env for recursion support
    localEnv.functions.set(fndef.name, [fndef.params.map(param => param.type), fndef.ret])

    localEnv.retType = fndef.ret;

    const typedStmts = typeCheckStmts(fndef.body2, localEnv);
    return {...fndef, a: fndef.ret, params: typedParams, body2: typedStmts, body1: typedVarDefs}

}

export function typeCheckStmts(stmts: Stmt<null>[], env : TypeEnv) : Stmt<Type>[] {
    const typedStmts : Stmt<Type>[] = [];
    stmts.forEach(stmt => {
        switch(stmt.tag) {
            case "expr":
                const typedExpr = typeCheckExpr(stmt.expr, env);
                const typedStmt = {...stmt, a: Type.none, expr: typedExpr};
                typedStmts.push(typedStmt);
                break;
            case "pass":
                typedStmts.push({...stmt, a: Type.none});
                break;
            case "assign":
                if (!env.vars.get(stmt.name)) 
                    throw new Error("TYPE ERROR : variable not found");
                const typExpr = typeCheckExpr(stmt.value, env);
                if (typExpr.a !== env.vars.get(stmt.name))
                    throw new Error("TYPE ERROR : LHS and RHS have incompatible types");
                typedStmts.push({...stmt, value: typExpr, a:Type.none});
                break;
            case "return":
                const newExpr = typeCheckExpr(stmt.value, env);
                if (newExpr.a !== env.retType) {
                    throw new Error(`${newExpr} returned but ${env.retType} expected.`);
                }
                typedStmts.push({...stmt, value: newExpr, a:Type.none});
                break;
            default:
                throw new Error("TYPE ERROR : Unknown statement type");
        }
    })
    return typedStmts;
}

function createNewEnv() : TypeEnv {
    return  { vars : new Map<string, Type>(), 
        functions : new Map<string, [Type.none[], Type.none]>(), retType : Type.none}
}

export function typeCheckProgram(prgm : Program<null>) : Program<Type> {

    const env = createNewEnv();
    const varDefs:VarDefs<Type>[] = typeCheckVarDefs(prgm.varDefs, env);
    varDefs.forEach(def => {
        env.vars.set(def.name, def.type);
    })

    const funDefs:FunDefs<Type>[] = [];
    prgm.funDefs.forEach(f => {
        const typedFunction = typeCheckFunDef(f, env)
        env.functions.set(typedFunction.name, [typedFunction.params.map(p => p.type), typedFunction.ret]);
        funDefs.push(typedFunction);
    });

    const typedStatements = typeCheckStmts(prgm.stmts, env)
    return {a: Type.none, varDefs, funDefs, stmts : typedStatements}

}