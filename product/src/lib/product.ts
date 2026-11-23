import configuration from "../../product.config.json";
import { productSchema } from "../../shared/product";

// Public metadata only; never put credentials in this file.
export const product = productSchema.parse(configuration);
