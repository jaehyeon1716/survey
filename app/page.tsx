"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase, type SurveyData } from "@/lib/supabase/client"
import { CheckCircle, Heart } from "lucide-react"

const questions = [
  "병원 직원들이 친절하게 대해주었습니까?",
  "진료 대기시간이 적절했습니까?",
  "의료진의 설명이 이해하기 쉬웠습니까?",
  "병원 시설이 깨끗하고 쾌적했습니까?",
  "진료 결과에 만족하십니까?",
  "병원 접근성(교통, 주차 등)이 편리했습니까?",
  "예약 및 접수 과정이 편리했습니까?",
  "병원비가 적절하다고 생각하십니까?",
  "이 병원을 다른 사람에게 추천하시겠습니까?",
]

const scaleLabels = [
  { value: 5, label: "매우 그렇다", color: "bg-green-500" },
  { value: 4, label: "그렇다", color: "bg-green-400" },
  { value: 3, label: "보통이다", color: "bg-yellow-400" },
  { value: 2, label: "그렇지 않다", color: "bg-orange-400" },
  { value: 1, label: "전혀 그렇지 않다", color: "bg-red-400" },
]

export default function HospitalSurvey() {
  const [answers, setAnswers] = useState<Partial<SurveyData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)

  const handleAnswer = (questionIndex: number, value: number) => {
    const questionKey = `question_${questionIndex + 1}` as keyof SurveyData
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: value,
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
    // 모든 문항이 답변되었는지 확인
    const allAnswered = questions.every((_, index) => {
      const questionKey = `question_${index + 1}` as keyof SurveyData
      return answers[questionKey] !== undefined
    })

    if (!allAnswered) {
      alert("모든 문항에 답변해 주세요.")
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.from("hospital_surveys").insert([answers as SurveyData])

      if (error) {
        console.error("Error submitting survey:", error)
        alert("설문 제출 중 오류가 발생했습니다. 다시 시도해 주세요.")
      } else {
        setIsSubmitted(true)
      }
    } catch (error) {
      console.error("Error:", error)
      alert("설문 제출 중 오류가 발생했습니다. 다시 시도해 주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentQuestionKey = `question_${currentQuestion + 1}` as keyof SurveyData
  const currentAnswer = answers[currentQuestionKey]
  const progress = ((currentQuestion + 1) / questions.length) * 100

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="text-center py-16">
            <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-8" />
            <h1 className="text-4xl font-bold text-gray-800 mb-4">설문 완료</h1>
            <p className="text-2xl text-gray-600 mb-8">소중한 의견을 주셔서 감사합니다.</p>
            <p className="text-xl text-gray-500">더 나은 의료 서비스를 위해 활용하겠습니다.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-800 mb-2">병원 만족도 조사</h1>
          <p className="text-xl text-gray-600">더 나은 의료 서비스를 위한 여러분의 소중한 의견을 들려주세요</p>
        </div>

        {/* 진행률 표시 */}
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

        {/* 현재 질문 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-gray-800">문항 {currentQuestion + 1}</CardTitle>
          </CardHeader>
          <CardContent>
            <h2 className="text-3xl font-medium text-center text-gray-800 mb-12 leading-relaxed">
              {questions[currentQuestion]}
            </h2>

            {/* 답변 선택지 */}
            <div className="space-y-4">
              {scaleLabels.map((scale) => (
                <button
                  key={scale.value}
                  onClick={() => handleAnswer(currentQuestion, scale.value)}
                  className={`w-full p-6 rounded-xl border-2 transition-all duration-200 text-xl font-medium ${
                    currentAnswer === scale.value
                      ? `${scale.color} text-white border-gray-400 shadow-lg scale-105`
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{scale.label}</span>
                    <span className="text-2xl font-bold">{scale.value}점</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between items-center">
          <Button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            variant="outline"
            size="lg"
            className="text-xl px-8 py-4 h-auto bg-transparent"
          >
            이전
          </Button>

          <div className="flex space-x-4">
            {currentQuestion === questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={!currentAnswer || isSubmitting}
                size="lg"
                className="text-xl px-12 py-4 h-auto bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "제출 중..." : "설문 완료"}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!currentAnswer} size="lg" className="text-xl px-8 py-4 h-auto">
                다음
              </Button>
            )}
          </div>
        </div>

        {/* 답변 현황 표시 */}
        <div className="mt-8 p-6 bg-white rounded-xl shadow-sm">
          <h3 className="text-xl font-medium text-gray-800 mb-4">답변 현황</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
            {questions.map((_, index) => {
              const questionKey = `question_${index + 1}` as keyof SurveyData
              const isAnswered = answers[questionKey] !== undefined
              const isCurrent = index === currentQuestion

              return (
                <div
                  key={index}
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
