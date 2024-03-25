import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadCloudinary } from "../utils/cloudinary.js"
import { User } from "../models/user.model.js"


const generateAccessAndRefreshTokens = asyncHandler(async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
})

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { fullName, username, email, password } = req.body
    console.log("email :", email)
    console.log("username :", username)
    console.log("fullName :", fullName)
    console.log("password :", password)

    if ([fullName, username, email, password].some((field) => field.trim() === "")) {
        throw new ApiError(400, "All fields are required ")
    }

    const exitedUser = await User.findOne({
        $or: [{ email }, { username }]
    })
    if (exitedUser) {
        throw new ApiError(409, "user with username or email already exists ")
    }
    // check what we get in files then explore all 
    console.log(req.files)

    const avatarLocalPath = req.files?.[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is required")
    }

    const avatar = await uploadCloudinary(avatarLocalPath)
    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "avatar file is required")

    }
    const user = User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()

    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "somthing went wrong while registering a  user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registerd successfully")
    )


})

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie
    const { email, password, username } = req.body
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "user does not exist")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly: true,
        secure:true
    } 

    res.status(200).cookie("accessToken", accessToken,options).cookie("accessToken", accessToken,options).json(
        new ApiResponse(200, {user:loggedInUser,refreshToken,accessToken},"")
    )


    })

const logoutUser= asyncHandler(async(req,res)=>{
    User.findById(req.user._id,{
        $unset:{
            refreshToken:1,// this removes the field from document
        }},
        {
            new:true
        }
    )
    const options={
        httpOnly:true,
        secure:true
    }
    
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"user logged out"))

})
export { registerUser ,loginUser}