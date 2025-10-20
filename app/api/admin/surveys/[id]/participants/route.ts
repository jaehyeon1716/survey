import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    const body = await request.json()
    const { participants, isFirstBatch } = body

    if (!participants || !Array.isArray(participants)) {
      return NextResponse.json({ error: "참여자 데이터가 필요합니다." }, { status: 400 })
    }

    if (participants.length === 0) {
      return NextResponse.json({ error: "참여자 데이터가 비어있습니다." }, { status: 400 })
    }

    if (isFirstBatch) {
      console.log("[v0] 첫 번째 배치: 기존 참여자 삭제 중...")
      await supabase
        .from("survey_responses")
        .delete()
        .eq(
          "participant_token",
          supabase.from("survey_participants").select("token").eq("survey_id", Number.parseInt(surveyId)),
        )
      await supabase.from("survey_participants").delete().eq("survey_id", Number.parseInt(surveyId))
    }

    const participantsWithTokens = participants.map((p) => ({
      survey_id: Number.parseInt(surveyId),
      token: randomBytes(16).toString("hex"),
      hospital_name: p.hospital_name,
      participant_name: p.participant_name,
      phone_number: p.phone_number,
    }))

    const { error } = await supabase.from("survey_participants").insert(participantsWithTokens)

    if (error) {
      console.error("[v0] 삽입 오류:", error)
      throw new Error(`참여자 등록 중 오류 발생: ${error.message}`)
    }

    console.log(`[v0] ${participantsWithTokens.length}명 등록 완료`)

    return NextResponse.json({
      message: `${participantsWithTokens.length}명의 참여자가 등록되었습니다.`,
      count: participantsWithTokens.length,
    })
  } catch (error) {
    console.error("[v0] 참여자 등록 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "참여자 등록 중 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}
