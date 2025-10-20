import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"

const BATCH_SIZE = 1000

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    const formData = await request.formData()
    const csvFile = formData.get("csvFile") as File

    if (!csvFile) {
      return NextResponse.json({ error: "CSV 파일이 필요합니다." }, { status: 400 })
    }

    const csvText = await csvFile.text()
    const lines = csvText.trim().split("\n")

    if (lines.length === 0) {
      return NextResponse.json({ error: "CSV 파일이 비어있습니다." }, { status: 400 })
    }

    await supabase
      .from("survey_responses")
      .delete()
      .eq(
        "participant_token",
        supabase.from("survey_participants").select("token").eq("survey_id", Number.parseInt(surveyId)),
      )
    await supabase.from("survey_participants").delete().eq("survey_id", Number.parseInt(surveyId))

    const participants = []
    const uniqueParticipants = new Set()

    for (const line of lines) {
      const [hospitalName, participantName, phoneNumber] = line.split("|").map((item) => item.trim())

      if (!hospitalName || !participantName || !phoneNumber) {
        continue
      }

      const participantKey = `${hospitalName}|${participantName}|${phoneNumber}`
      if (uniqueParticipants.has(participantKey)) {
        continue
      }
      uniqueParticipants.add(participantKey)

      const token = randomBytes(16).toString("hex")
      participants.push({
        survey_id: Number.parseInt(surveyId),
        token,
        hospital_name: hospitalName,
        participant_name: participantName,
        phone_number: phoneNumber,
      })
    }

    if (participants.length === 0) {
      return NextResponse.json({ error: "유효한 참여자 데이터가 없습니다." }, { status: 400 })
    }

    let totalInserted = 0
    const totalBatches = Math.ceil(participants.length / BATCH_SIZE)

    for (let i = 0; i < participants.length; i += BATCH_SIZE) {
      const batch = participants.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from("survey_participants").insert(batch)

      if (error) {
        console.error(`배치 ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches} 삽입 오류:`, error)
        throw new Error(`배치 처리 중 오류 발생: ${error.message}`)
      }

      totalInserted += batch.length
      console.log(
        `[v0] 진행률: ${totalInserted}/${participants.length} (${Math.round((totalInserted / participants.length) * 100)}%)`,
      )
    }

    return NextResponse.json({
      message: `${participants.length}명의 참여자가 성공적으로 등록되었습니다.`,
      count: participants.length,
      batches: totalBatches,
    })
  } catch (error) {
    console.error("참여자 등록 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "참여자 등록 중 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}
