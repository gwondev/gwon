import { Typography } from "@mui/material"

export const Title1 = ({size, text}) => {
    return (
        <Typography fontSize={{xs: size-3 ,sm: size }} color="#222" fontWeight={999} lineHeight={1}>
            {text}
        </Typography>
    )
}

export const Body1 = ({size, text}) => {
    return (
        <Typography fontSize={{xs: size-3 ,sm: size }} fontWeight={300} lineHeight={1}>
            {text}
        </Typography>
    )
}

export const Caption1 = ({size, text}) => {
    return (
        <Typography fontSize={{xs: size-3, sm: size }} fontWeight={300} lineHeight={1} color="text.secondary">
            {text}
        </Typography>
    )
}