import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: surveys, error } = await supabase
      .from("surveys")
      .select(`
        *,
        survey_questions (
          id,
          question_order,
          question_text,
          answer_options
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
  try {
    const supabase = await createClient()

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

    const questionsData = questions.map(
      (q: { question: string; answers: { text: string; score: number }[] }, index: number) => ({
        survey_id: survey.id,
        question_order: index + 1,
        question_text: q.question,
        answer_options: q.answers, // 점수 포함한 답변 옵션을 JSON으로 저장
      }),
    )

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
