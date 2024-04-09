import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadCloudinary } from "../utils/cloudinary.js"
import { User } from "../models/user.model.js"
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'


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

    const options = {
        httpOnly: true,
        secure: true
    }

    res.status(200).cookie("accessToken", accessToken, options).cookie("accessToken", accessToken, options).json(
        new ApiResponse(200, { user: loggedInUser, refreshToken, accessToken }, "")
    )


})

const logoutUser = asyncHandler(async (req, res) => {
    User.findById(req.user._id, {
        $unset: {
            refreshToken: 1,// this removes the field from document
        }
    },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "user logged out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }
    try {
        const decodeToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodeToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

        res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiError(200, { accessToken, refreshToken: newRefreshToken }, "access token refreshed"))

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.
        status(200).
        json(new ApiResponse(200, {}, "password change successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { email, fullName } = req.body
    if (!email || !fullName) {
        throw new ApiError(400, "All field are required")
    }
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {
            new: true
        }

    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = uploadCloudinary(avatarLocalPath)
    // console.log(avatar) //i want to check here what i get in avatar

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {

            new: true
        }

    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar image updated successfully"))

})

const updateUserCoverImage= asyncHandler(async(req,res)=>{
    const coverImageLocalPath= req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Error while uploading on coverImageLocalPath")
    }
    const coverImage= await uploadCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on coverImage")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },

        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 ,user,"Cover image updated successfully"))

})

const getUserProfileChannel=asyncHandler(async(req,res)=>{
    const {username}= req.params

    if(!username.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel= await User.aggregate([
       { 
        $match:{
            username:username.toLowerCase()
        }
    },
    {
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subcribers"
        }
    },
    {
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subcriber",
            as:"subcribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount:{
                $size: "$subcribers"
            },
            channelsSubscribedToCount:{
                $size: "$subcribedTo"
            },
           
            isSubscribed:{
                $cond:{
                    if:{
                        $in:[req.user?._id,"$subscribers.subscriber"]
                    },
                    then:true,
                    else:false
                }
            }
        }
    },
    {
        $project:{
            fullName:1,
            email:1,
            username:1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,

        }

    }
    ])

    if(!channel?.length){
        throw new ApiResponse(404,"channel does not exists")
    }

    return res
    .status(200)
    .json(200, channel[0],"User channel fetched successfully")
})

const getWatchHistory=asyncHandler(async(req, res)=>{
    const user= await User.aggregate([
        {
            $match:{ _id: new mongoose.Type.ObjectId(req.user._id)}
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(new ApiResponse(200,user[0].watchHistory,"Watch history fetched successfully"))
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserCoverImage,
    updateUserAvatar,
    getUserProfileChannel,
    getWatchHistory

}