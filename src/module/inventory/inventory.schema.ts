import { z } from "zod"

export const forecastParaSchema = z.object({
    id: z.string().uuid("Invalid Product ID format")
})

export const forecastQuerySchema = z.object({
    days: z
        .string()
        .optional()
        .transform((val) => (val ? Number(val) : 30))
        .refine((val) => val > 0, {
        message: "Days must be greater than 0"
    })
    
    
})

export type FoercastParams = z.infer<typeof forecastParaSchema>
export type ForecastQuery = z.infer<typeof forecastQuerySchema>