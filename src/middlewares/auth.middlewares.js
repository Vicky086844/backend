import { asyncHandler } from "../utils/asyncHandler";
import  jwt  from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { User } from "../models/user.model";

export const verifyJWT= asyncHandler(async(req,res,next)=>{
    try {
        const token= req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
        console.log(token)
        if(!token){
            throw new ApiError(401,"unauthorized request")
        }
        const decodeToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user = User.findById(decodeToken?._id).select("-password -refreshToken")
        if(!user){
            throw new ApiError(401,"Invalid access token")
        }
        req.user= user;
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})