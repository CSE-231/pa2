import { Expr, Literal, Type, UnaryOp } from "./ast";

type FunctionsEnv = Map<string, [Type[], Type]>;
type BodyEnv = Map<string, Type>;


export function typeCheckExpr(expr : Expr<null>) : Expr<Type> {
    switch(expr.tag) {
        case "num": return {...expr, a: Type.int};
       
        case "literal": 
            const lit = typeCheckLiteral(expr.literal); 
            return {...expr, a: lit.a, literal: lit};

        case "builtin2":
            const arg1 = typeCheckExpr(expr.arg1);
            const arg2 = typeCheckExpr(expr.arg2);
            if (arg1.a !== Type.int && arg2.a !== Type.int) {
                throw new Error("TypeError : Expression does not evaluate to int");
            }
            return {...expr, a: Type.int, arg1, arg2}; 

        case "builtin1":
            const arg = typeCheckExpr(expr.arg);
            if (arg.a !== Type.int) {
                throw new Error("TypeError : Expression does not evaluate to int");
            }
            return {...expr, a: Type.int, arg}; 
        
        case "binExpr":
            const left = typeCheckExpr(expr.left);
            const right = typeCheckExpr(expr.right);
            if (left.a !== Type.int && right.a !== Type.int) {
                throw new Error("TypeError : Expression does not evaluate to int");
            }
            return {...expr, a: Type.int, left, right}; 

        case "unExpr":
            const rt = typeCheckExpr(expr.right);
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