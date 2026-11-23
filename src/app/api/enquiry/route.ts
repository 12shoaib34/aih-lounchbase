import { handleEnquiry } from "../../../server/site/enquiry";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleEnquiry(request); }
export function POST(request: Request) { return handleEnquiry(request); }
