import {asyncHandler}from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {uploadCloudinary} from "../utils/cloudinary.js"
import { User } from "../models/user.model.js"

const registerUser= asyncHandler(async(req,res)=>{
   // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName, username,email,password}= req.body
    console.log("email :" ,email )
    console.log("username :" ,username )
    console.log("fullName :" ,fullName )
    console.log("password :" ,password )

    if([fullName,username,email,password].some((field)=>field.trim()=== "")){
        throw new ApiError(400,"All fields are required ") 
    }

    const exitedUser = await User.findOne({
        $or: [ {email} ,{username}]
    })
    if(exitedUser){
        throw new ApiError(409, "user with username or email already exists ")
    }
    // check what we get in files then explore all 
    console.log(req.files)

    const avatarLocalPath = req.files?.[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath= req.files.coverImage[0].path;
    }
    if(!avatarLocalPath){
        throw new ApiError(400,"avatar file is required")
    }

    const avatar = await uploadCloudinary(avatarLocalPath)
    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"avatar file is required")
        
    }
    const user = User.create({
        fullName,
       avatar: avatar.url,
       coverImage: coverImage?.url || "" ,
       email,
       password,
       username:username.toLowerCase()

    })
     const createdUser= await User.findById(user._id).select(
        "-password -refreshToken"
     )

    if(!createdUser){
        throw new ApiError(500,"somthing went wrong while registering a  user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"user registerd successfully")
    )


})
export {registerUser}