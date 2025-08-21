import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    const { title, description, questions } = await request.json()

    if (!title || !questions || questions.length === 0) {
      return NextResponse.json({ error: "제목과 문항은 필수입니다." }, { status: 400 })
    }

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    // 1. 먼저 해당 설문의 참여자 토큰들을 조회
    const { data: participants, error: participantsSelectError } = await supabase
      .from("survey_participants")
      .select("token")
      .eq("survey_id", Number.parseInt(surveyId))

    if (participantsSelectError) throw participantsSelectError

    // 2. 참여자 토큰이 있으면 설문 응답 삭제
    if (participants && participants.length > 0) {
      const tokens = participants.map((p) => p.token)
      const { error: responsesError } = await supabase.from("survey_responses").delete().in("participant_token", tokens)

      if (responsesError) throw responsesError
    }

    // 3. 참여자 삭제
    const { error: participantsError } = await supabase
      .from("survey_participants")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (participantsError) throw participantsError

    // 4. 설문 문항 삭제
    const { error: questionsError } = await supabase
      .from("survey_questions")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (questionsError) throw questionsError

    // 5. 설문지 삭제
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
