import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone", poweredByHeader: false,
  async redirects() {
    return [
      {source:"/index.html",destination:"/",permanent:true},
      {source:"/index",destination:"/",permanent:true},
      {source:"/:page(services|studio|ventures|work|engagements|contact|privacy|blog).html",destination:"/:page",permanent:true}
    ];
  }
};
export default config;
