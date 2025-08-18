import { Typography } from "@mui/material"

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