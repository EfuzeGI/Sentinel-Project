import { NextRequest, NextResponse } from "next/server";

const getAgentUrl = () => {
    const agentUrl = process.env.NEXT_PUBLIC_AGENT_API_URL || "https://sentinel-production-6e53.up.railway.app/";
    return agentUrl.endsWith("/") ? agentUrl.slice(0, -1) : agentUrl;
};

export async function GET() {
    try {
        const targetUrl = `${getAgentUrl()}/vaults`;
        const response = await fetch(targetUrl, { cache: 'no-store' });
        if (!response.ok) return NextResponse.json({ error: "Agent unreachable" }, { status: 502 });
        const data = await response.json();
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: "Proxy error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { wallet_id } = body;

        if (!wallet_id) {
            return NextResponse.json({ error: "wallet_id is required" }, { status: 400 });
        }

        const targetUrl = `${getAgentUrl()}/register-vault`;

        console.log(`[Proxy] Registering ${wallet_id} at ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet_id }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Agent error ${response.status}` }, { status: response.status });
        }

        return NextResponse.json(await response.json());
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
