import { businessInput, type Business } from "../../../shared/business";

export const emptyBusiness: Business = {
  ...businessInput.parse({
    name: "Business",
    email: "",
    phone: "",
    timezone: "UTC",
    currency: "USD",
    locale: "en",
    locations: [],
  }),
  name: "",
};
