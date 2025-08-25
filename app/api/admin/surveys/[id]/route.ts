import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const surveyId = params.id

  try {
    const { title, description, questions } = await request.json()

    if (!title || !questions || questions.length === 0) {
      return NextResponse.json({ error: "제목과 문항은 필수입니다." }, { status: 400 })
    }

    const supabase = await createClient()

    const { error: surveyError } = await supabase
      .from("surveys")
      .update({
        title,
        description: description || "",
      })
      .eq("id", Number.parseInt(surveyId))

    if (surveyError) throw surveyError

    const { error: deleteError } = await supabase
      .from("survey_questions")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (deleteError) throw deleteError

    const questionsData = questions.map((questionText: string, index: number) => ({
      survey_id: Number.parseInt(surveyId),
      question_number: index + 1,
      question_text: questionText,
    }))

    const { error: questionsError } = await supabase.from("survey_questions").insert(questionsData)

    if (questionsError) throw questionsError

    return NextResponse.json({
      message: "설문지가 성공적으로 수정되었습니다.",
    })
  } catch (error) {
    console.error("설문지 수정 오류:", error)
    return NextResponse.json({ error: "설문지 수정 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const surveyId = params.id

    // 관련된 데이터들을 순서대로 삭제
    // 1. 설문 응답 삭제
    await supabase.from("survey_responses").delete().eq("survey_id", Number.parseInt(surveyId))

    // 2. 설문 참여자 삭제
    await supabase.from("survey_participants").delete().eq("survey_id", Number.parseInt(surveyId))

    // 3. 설문 문항 삭제
    await supabase.from("survey_questions").delete().eq("survey_id", Number.parseInt(surveyId))

    // 4. 설문지 삭제
    const { error: surveyError } = await supabase.from("surveys").delete().eq("id", Number.parseInt(surveyId))

    if (surveyError) throw surveyError

    return NextResponse.json({
      message: "설문지가 성공적으로 삭제되었습니다.",
    })
  } catch (error) {
    console.error("설문지 삭제 오류:", error)
    return NextResponse.json({ error: "설문지 삭제 중 오류가 발생했습니다." }, { status: 500 })
  }
}
