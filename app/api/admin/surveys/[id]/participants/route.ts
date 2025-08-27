import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { randomBytes } from "crypto"
import { cookies } from "next/headers"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })

  const surveyId = params.id

  try {
    const { data: participants, error } = await supabase
      .from("survey_participants")
      .select("*")
      .eq("survey_id", Number.parseInt(surveyId))
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(participants || [])
  } catch (error) {
    console.error("참여자 조회 오류:", error)
    return NextResponse.json({ error: "참여자 데이터를 불러오는데 실패했습니다." }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })

  const surveyId = params.id

  try {
    const formData = await request.formData()
    const csvFile = formData.get("file") as File

    if (!csvFile) {
      return NextResponse.json({ error: "CSV 파일이 필요합니다." }, { status: 400 })
    }

    const csvText = await csvFile.text()
    const lines = csvText.trim().split("\n")

    if (lines.length === 0) {
      return NextResponse.json({ error: "CSV 파일이 비어있습니다." }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from("survey_participants")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (deleteError) {
      console.error("기존 참여자 삭제 오류:", deleteError)
    }

    const participants = []
    const uniqueParticipants = new Set() // 중복 방지를 위한 Set

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
        is_completed: false,
      })
    }

    if (participants.length === 0) {
      return NextResponse.json({ error: "유효한 참여자 데이터가 없습니다." }, { status: 400 })
    }

    const { error } = await supabase.from("survey_participants").insert(participants)

    if (error) throw error

    return NextResponse.json({
      message: `${participants.length}명의 참여자가 성공적으로 등록되었습니다.`,
      count: participants.length,
    })
  } catch (error) {
    console.error("참여자 등록 오류:", error)
    return NextResponse.json({ error: "참여자 등록 중 오류가 발생했습니다." }, { status: 500 })
  }
}
