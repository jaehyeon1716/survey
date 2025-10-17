"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase/client"
import { CheckCircle, Heart, AlertCircle } from "lucide-react"

const scaleLabels_default = [
  { value: 5, label: "매우 그렇다", color: "bg-green-500" },
  { value: 4, label: "그렇다", color: "bg-green-400" },
  { value: 3, label: "보통이다", color: "bg-yellow-400" },
  { value: 2, label: "그렇지 않다", color: "bg-orange-400" },
  { value: 1, label: "전혀 그렇지 않다", color: "bg-red-400" },
]

const scaleLabels_9 = [
  { value: 5, label: "매우 만족한다", color: "bg-green-500" },
  { value: 4, label: "만족한다", color: "bg-green-400" },
  { value: 3, label: "보통이다", color: "bg-yellow-400" },
  { value: 2, label: "불만족한다", color: "bg-orange-400" },
  { value: 1, label: "매우 불만족한다", color: "bg-red-400" },
]

type Participant = {
  id: number
  survey_id: number
  token: string
  hospital_name: string
  participant_name: string
  phone_number: string
  is_completed: boolean
}

type Survey = {
  id: number
  title: string
  description: string
  is_active: boolean
  response_scale_type?: string
}

type Question = {
  id: number
  question_number: number
  question_text: string
  question_type: "objective" | "subjective"
}

export default function HospitalSurvey() {
  const params = useParams()
  const token = params.token as string

  const [participant, setParticipant] = useState<Participant | null>(null)
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const validateTokenAndLoadSurvey = async () => {
      if (!token) {
        setError("유효하지 않은 접근입니다. 올바른 링크를 통해 접속해 주세요.")
        setLoading(false)
        return
      }

      if (!supabase) {
        setError("데이터베이스 연결 설정이 필요합니다.")
        setLoading(false)
        return
      }

      try {
        const { data: participantData, error: participantError } = await supabase
          .from("survey_participants")
          .select(`
            *,
            surveys (
              id,
              title,
              description,
              is_active,
              response_scale_type
            )
          `)
          .eq("token", token)
          .single()

        if (participantError || !participantData) {
          setError("유효하지 않은 토큰입니다. 관리자에게 문의해 주세요.")
          setLoading(false)
          return
        }

        if (participantData.is_completed) {
          setError("이미 완료된 설문입니다. 감사합니다.")
          setLoading(false)
          return
        }

        if (!participantData.surveys?.is_active) {
          setError("현재 비활성화된 설문입니다. 관리자에게 문의해 주세요.")
          setLoading(false)
          return
        }

        setParticipant(participantData)
        setSurvey(participantData.surveys)

        const { data: questionsData, error: questionsError } = await supabase
          .from("survey_questions")
          .select("*")
          .eq("survey_id", participantData.survey_id)
          .order("question_number", { ascending: true })

        if (questionsError || !questionsData || questionsData.length === 0) {
          setError("설문 문항을 불러올 수 없습니다. 관리자에게 문의해 주세요.")
          setLoading(false)
          return
        }

        setQuestions(questionsData)

        const { data: existingResponses, error: responsesError } = await supabase
          .from("survey_responses")
          .select("question_id, response_value, response_text")
          .eq("participant_token", token)

        if (!responsesError && existingResponses) {
          const existingAnswers: Record<number, number> = {}
          const existingSubjectiveAnswers: Record<number, string> = {}
          existingResponses.forEach((response) => {
            if (response.response_value !== null) {
              existingAnswers[response.question_id] = response.response_value
            }
            if (response.response_text) {
              existingSubjectiveAnswers[response.question_id] = response.response_text
            }
          })
          setAnswers(existingAnswers)
          setSubjectiveAnswers(existingSubjectiveAnswers)
        }
      } catch (err) {
        console.error("Token validation error:", err)
        setError("설문 정보를 불러오는 중 오류가 발생했습니다.")
      } finally {
        setLoading(false)
      }
    }

    validateTokenAndLoadSurvey()
  }, [token])

  const handleAnswer = (questionId: number, value: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleSubjectiveAnswer = (questionId: number, text: string) => {
    setSubjectiveAnswers((prev) => ({
      ...prev,
      [questionId]: text,
    }))
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = async () => {
    const allAnswered = questions.every((question) => {
      if (question.question_type === "subjective") {
        return subjectiveAnswers[question.id]?.trim().length > 0
      } else {
        return answers[question.id] !== undefined
      }
    })

    if (!allAnswered) {
      alert("모든 문항에 답변해 주세요.")
      return
    }

    setIsSubmitting(true)

    try {
      if (!supabase || !participant) {
        throw new Error("설문 제출에 필요한 정보가 없습니다.")
      }

      console.log("[v0] Submitting responses for participant:", participant.token)

      const responses = questions.map((question) => ({
        participant_token: participant.token,
        question_id: question.id,
        response_value: question.question_type === "objective" ? answers[question.id] : null,
        response_text: question.question_type === "subjective" ? subjectiveAnswers[question.id] : null,
      }))

      console.log("[v0] Responses to submit:", responses)

      await supabase.from("survey_responses").delete().eq("participant_token", participant.token)

      const { error: insertError } = await supabase.from("survey_responses").insert(responses)

      if (insertError) {
        console.error("[v0] Error submitting survey:", insertError)
        console.error("[v0] Error details:", {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        })

        if (insertError.message.includes("이미 설문을 완료한 참여자입니다")) {
          setError("이미 완료된 설문입니다. 중복 응답은 불가능합니다.")
          return
        }
        alert(`설문 제출 중 오류가 발생했습니다: ${insertError.message}`)
      } else {
        console.log("[v0] Survey submitted successfully")
        setIsSubmitted(true)
      }
    } catch (error) {
      console.error("[v0] Unexpected error:", error)
      alert("설문 제출 중 오류가 발생했습니다. 다시 시도해 주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-16">
            <AlertCircle className="w-24 h-24 text-red-500 mx-auto mb-8" />
            <h1 className="text-4xl font-bold text-gray-800 mb-4">설정 오류</h1>
            <p className="text-2xl text-gray-600 mb-8">데이터베이스 연결 설정이 필요합니다.</p>
            <p className="text-xl text-gray-500">관리자에게 문의해 주세요.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-16">
            <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-blue-500 mx-auto mb-8"></div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">설문 정보 확인 중...</h1>
            <p className="text-xl text-gray-600">잠시만 기다려 주세요.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-16">
            <AlertCircle className="w-24 h-24 text-red-500 mx-auto mb-8" />
            <h1 className="text-4xl font-bold text-gray-800 mb-4">접근 오류</h1>
            <p className="text-2xl text-gray-600 mb-8">{error}</p>
            <p className="text-xl text-gray-500">문의사항이 있으시면 관리자에게 연락해 주세요.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentQuestionData = questions[currentQuestion]
  const currentAnswer =
    currentQuestionData?.question_type === "objective"
      ? answers[currentQuestionData?.id]
      : subjectiveAnswers[currentQuestionData?.id]
  const progress = ((currentQuestion + 1) / questions.length) * 100

  const scaleLabels = survey?.response_scale_type === "satisfaction" ? scaleLabels_9 : scaleLabels_default

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-16">
            <AlertCircle className="w-24 h-24 text-yellow-500 mx-auto mb-8" />
            <h1 className="text-4xl font-bold text-gray-800 mb-4">설문 문항 없음</h1>
            <p className="text-2xl text-gray-600 mb-8">이 설문에는 아직 문항이 등록되지 않았습니다.</p>
            <p className="text-xl text-gray-500">관리자에게 문의해 주세요.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-16">
            <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-8" />
            <h1 className="text-4xl font-bold text-gray-800 mb-4">설문 완료</h1>
            <p className="text-2xl text-gray-600 mb-4">소중한 의견을 주셔서 감사합니다.</p>
            <div className="bg-blue-50 p-6 rounded-lg mb-6">
              <p className="text-xl text-blue-800 font-medium">{participant?.participant_name}님</p>
              <p className="text-lg text-blue-600">{participant?.hospital_name}</p>
              {survey && <p className="text-lg text-blue-600 mt-2">"{survey.title}" 설문 완료</p>}
            </div>
            <p className="text-xl text-gray-500">더 나은 의료 서비스를 위해 활용하겠습니다.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{survey?.title || "설문조사"}</h1>
          <p className="text-xl text-gray-600 mb-6">
            {survey?.description || "더 나은 서비스를 위한 여러분의 소중한 의견을 들려주세요"}
          </p>

          {participant && (
            <div className="bg-white p-6 rounded-xl shadow-sm max-w-md mx-auto">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800 mb-2">{participant.participant_name}님 안녕하세요</p>
                <p className="text-xl text-blue-600 font-medium">{participant.hospital_name} 만족도조사입니다</p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-medium text-gray-700">
              진행률: {currentQuestion + 1} / {questions.length}
            </span>
            <span className="text-lg font-medium text-gray-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-center text-gray-800">문항 {currentQuestion + 1}</CardTitle>
          </CardHeader>
          <CardContent>
            <h2 className="text-xl font-medium text-center text-gray-800 mb-6 leading-relaxed px-2">
              {currentQuestionData?.question_text}
            </h2>

            <div className="flex justify-between items-center mb-6">
              <Button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                variant="outline"
                size="lg"
                className="text-base px-4 py-2 h-auto bg-transparent"
              >
                이전
              </Button>

              <div className="flex space-x-4">
                {currentQuestion === questions.length - 1 ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!currentAnswer || isSubmitting}
                    size="lg"
                    className="text-base px-4 py-2 h-auto bg-green-600 hover:bg-green-700"
                  >
                    {isSubmitting ? "제출 중..." : "설문 완료"}
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={!currentAnswer} size="lg" className="text-lg px-4 py-2 h-auto">
                    다음
                  </Button>
                )}
              </div>
            </div>

            {currentQuestionData?.question_type === "subjective" ? (
              <div className="space-y-4">
                <Textarea
                  value={subjectiveAnswers[currentQuestionData.id] || ""}
                  onChange={(e) => handleSubjectiveAnswer(currentQuestionData.id, e.target.value)}
                  placeholder="여기에 답변을 입력해 주세요..."
                  className="min-h-[200px] text-base p-4 resize-none"
                />
                <p className="text-sm text-gray-500 text-center">자유롭게 의견을 작성해 주세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scaleLabels.map((scale) => (
                  <button
                    key={scale.value}
                    onClick={() => handleAnswer(currentQuestionData.id, scale.value)}
                    className={`w-full px-3 py-2 rounded-xl border-2 transition-all duration-200 text-base font-medium ${
                      answers[currentQuestionData.id] === scale.value
                        ? `${scale.color} text-white border-gray-400 shadow-lg scale-105`
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{scale.label}</span>
                      <span className="text-lg font-bold">{scale.value}점</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
          <h3 className="text-xl font-medium text-gray-800 mb-4">답변 현황</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
            {questions.map((question, index) => {
              const isAnswered =
                question.question_type === "objective"
                  ? answers[question.id] !== undefined
                  : subjectiveAnswers[question.id]?.trim().length > 0
              const isCurrent = index === currentQuestion

              return (
                <div
                  key={question.id}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                    isCurrent
                      ? "bg-blue-500 text-white ring-4 ring-blue-200"
                      : isAnswered
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {index + 1}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
