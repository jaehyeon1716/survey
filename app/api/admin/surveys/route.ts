import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: surveys, error } = await supabase
      .from("surveys")
      .select(`
        *,
        survey_questions (
          id,
          question_number,
          question_text,
          question_type
        )
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ surveys })
  } catch (error) {
    console.error("설문지 조회 오류:", error)
    return NextResponse.json({ error: "설문지 조회 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { title, description, questions } = await request.json()

    if (!title || !questions || questions.length === 0) {
      return NextResponse.json({ error: "제목과 문항은 필수입니다." }, { status: 400 })
    }

    // 설문지 생성
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        title,
        description: description || "",
        is_active: true,
      })
      .select()
      .single()

    if (surveyError) throw surveyError

    const questionsData = questions.map((question: { text: string; type: string }, index: number) => ({
      survey_id: survey.id,
      question_number: index + 1,
      question_text: question.text,
      question_type: question.type || "objective",
    }))

    const { error: questionsError } = await supabase.from("survey_questions").insert(questionsData)

    if (questionsError) throw questionsError

    return NextResponse.json({
      message: "설문지가 성공적으로 생성되었습니다.",
      survey: survey,
    })
  } catch (error) {
    console.error("설문지 생성 오류:", error)
    return NextResponse.json({ error: "설문지 생성 중 오류가 발생했습니다." }, { status: 500 })
  }
}
