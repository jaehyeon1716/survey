import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// 토큰 생성 함수
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// CSV 파싱 함수
function parseCSV(csvText: string): Array<{ hospital_name: string; participant_name: string; phone_number: string }> {
  const lines = csvText.trim().split("\n")
  const participants = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // CSV 파싱 (파이프(|)로 구분, 따옴표 처리)
    const values = line.split("|").map((val) => val.trim().replace(/^["']|["']$/g, ""))

    if (values.length >= 3) {
      participants.push({
        hospital_name: values[0],
        participant_name: values[1],
        phone_number: values[2],
      })
    }
  }

  return participants
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    const formData = await request.formData()
    const file = formData.get("csvFile") as File

    if (!file) {
      return NextResponse.json({ error: "CSV 파일이 필요합니다." }, { status: 400 })
    }

    // 파일 내용 읽기
    const csvText = await file.text()

    // CSV 파싱
    const participants = parseCSV(csvText)

    if (participants.length === 0) {
      return NextResponse.json({ error: "CSV 파일에서 유효한 데이터를 찾을 수 없습니다." }, { status: 400 })
    }

    // 토큰 생성 및 데이터베이스 저장
    const participantsWithTokens = participants.map((participant) => ({
      ...participant,
      token: generateToken(),
    }))

    // Supabase에 데이터 저장
    const { data, error } = await supabaseAdmin.from("survey_participants").insert(participantsWithTokens).select()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "데이터베이스 저장 중 오류가 발생했습니다." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${participants.length}명의 참여자가 성공적으로 등록되었습니다.`,
      participants: data,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "파일 업로드 중 오류가 발생했습니다." }, { status: 500 })
  }
}
