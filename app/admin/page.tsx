"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase/client"
import { Copy, Download, ExternalLink, Eye, Plus, Trash2, Edit, FileText } from "lucide-react"

const ADMIN_PASSWORD = "hospital2024"

interface Survey {
  id: number
  title: string
  description: string
  is_active: boolean
  created_at: string
  survey_questions?: Array<{
    id: number
    question_text: string
    question_number: number
  }>
}

interface Participant {
  id: number
  survey_id: number
  token: string
  hospital_name: string
  participant_name: string
  phone_number: string
  is_completed: boolean
  created_at: string
}

interface SurveyResponse {
  id: number
  participant_token: string
  question_id: number
  response_value: number
  created_at: string
  survey_participants?: {
    hospital_name: string
    participant_name: string
    phone_number: string
  }
  total_score: number
  max_possible_score: number
}

interface QuestionStat {
  id: number
  questionNumber: number
  questionText: string
  totalResponses: number
  averageScore: string
  maxScore: number
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadSuccess, setUploadSuccess] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const [newSurveyTitle, setNewSurveyTitle] = useState("")
  const [newSurveyDescription, setNewSurveyDescription] = useState("")
  const [newSurveyQuestions, setNewSurveyQuestions] = useState([
    { question: "", answers: ["매우 그렇다", "그렇다", "보통이다", "그렇지 않다", "전혀 그렇지 않다"] },
  ])
  const [createLoading, setCreateLoading] = useState(false)

  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [hospitalFilter, setHospitalFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editQuestions, setEditQuestions] = useState<string[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")

  const downloadParticipantsExcel = () => {
    if (!selectedSurvey || filteredParticipants.length === 0) {
      alert("다운로드할 참여자 데이터가 없습니다.")
      return
    }

    const excelData = filteredParticipants.map((participant) => ({
      참여자명: participant.participant_name,
      휴대폰번호: participant.phone_number,
      병원명: participant.hospital_name,
      설문링크: `${window.location.origin}/${participant.token}`,
    }))

    const headers = Object.keys(excelData[0])
    const csvContent = excelData
      .map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row]
            return typeof value === "string" && (value.includes(",") || value.includes('"'))
              ? `"${value.replace(/"/g, '""')}"`
              : value
          })
          .join(","),
      )
      .join("\n")

    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })

    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${selectedSurvey.title}_참여자연락처_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadGuide = () => {
    // HTML 기반 가이드 생성
    const guideHTML = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; line-height: 1.6; margin: 20px; }
          .header { text-align: center; color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 30px; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { color: #1e40af; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #3b82f6; padding-left: 10px; }
          .step { margin-bottom: 20px; padding: 15px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #10b981; }
          .step-title { font-weight: bold; color: #065f46; margin-bottom: 10px; }
          .step-content { margin-left: 15px; }
          .highlight { background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
          .warning { background-color: #fee2e2; padding: 10px; border-radius: 6px; border-left: 4px solid #ef4444; margin: 10px 0; }
          .info { background-color: #dbeafe; padding: 10px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 10px 0; }
          .code { background-color: #f1f5f9; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 14px; }
          .screenshot { width: 100%; max-width: 600px; border: 2px solid #e5e7eb; border-radius: 8px; margin: 10px 0; }
          ul { margin-left: 20px; }
          li { margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏥 병원 만족도 조사 시스템</h1>
          <h2>관리자 페이지 사용 가이드</h2>
          <p>버전 1.0 | ${new Date().toLocaleDateString("ko-KR")}</p>
        </div>

        <div class="section">
          <div class="section-title">📋 1. 설문지 생성 및 관리</div>
          
          <div class="step">
            <div class="step-title">1-1. 새 설문지 만들기</div>
            <div class="step-content">
              <ul>
                <li><span class="highlight">'설문지 생성'</span> 탭을 클릭합니다</li>
                <li>설문지 제목과 설명을 입력합니다</li>
                <li>문항을 하나씩 추가합니다 (예: "의료진의 친절도에 만족하십니까?")</li>
                <li>모든 문항은 5점 척도로 평가됩니다</li>
              </ul>
              <div class="info">
                💡 <strong>팁:</strong> 문항은 명확하고 이해하기 쉽게 작성하세요. 고령자가 주 대상이므로 간단한 표현을 사용하는 것이 좋습니다.
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-title">1-2. 설문지 수정 및 삭제</div>
            <div class="step-content">
              <ul>
                <li><span class="highlight">'설문지 목록'</span> 탭에서 기존 설문지를 확인할 수 있습니다</li>
                <li><span class="highlight">'수정'</span> 버튼으로 설문지 내용을 변경할 수 있습니다</li>
                <li><span class="highlight">'삭제'</span> 시에는 보안을 위해 관리자 비밀번호를 다시 입력해야 합니다</li>
              </ul>
              <div class="warning">
                ⚠️ <strong>주의:</strong> 설문지를 삭제하면 관련된 모든 참여자 데이터와 응답 결과도 함께 삭제됩니다.
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">👥 2. 참여자 등록 및 관리</div>
          
          <div class="step">
            <div class="step-title">2-1. CSV 파일로 참여자 등록</div>
            <div class="step-content">
              <ul>
                <li>설문지를 선택한 후 <span class="highlight">'참여자 등록'</span> 탭으로 이동합니다</li>
                <li>CSV 파일을 준비합니다 (파이프 구분자 사용)</li>
              </ul>
              <div class="code">
                CSV 파일 형식 예시:<br>
                서울대병원|김철수|010-1234-5678<br>
                연세대병원|이영희|010-9876-5432<br>
                고려대병원|박민수|010-5555-1234
              </div>
              <div class="info">
                💡 <strong>중요:</strong> 새로운 CSV 파일을 업로드하면 기존 참여자 목록은 초기화됩니다. 중복된 참여자(병원명, 이름, 전화번호가 모두 동일)는 자동으로 제거됩니다.
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-title">2-2. 참여자 목록 관리</div>
            <div class="step-content">
              <ul>
                <li><span class="highlight">'참여자 목록'</span> 탭에서 등록된 참여자를 확인할 수 있습니다</li>
                <li>병원명으로 검색하거나 완료/미완료 상태로 필터링할 수 있습니다</li>
                <li><span class="highlight">'연락처 다운로드'</span> 버튼으로 문자 발송용 파일을 다운로드할 수 있습니다</li>
                <li>각 참여자의 설문 링크를 개별적으로 복사할 수 있습니다</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📱 3. 문자 발송 가이드</div>
          
          <div class="step">
            <div class="step-title">3-1. 연락처 파일 준비</div>
            <div class="step-content">
              <ul>
                <li><span class="highlight">'참여자 목록'</span>에서 <span class="highlight">'연락처 다운로드'</span> 클릭</li>
                <li>다운로드된 CSV 파일에는 다음 정보가 포함됩니다:</li>
              </ul>
              <div class="code">
                - 병원명<br>
                - 참여자명<br>
                - 휴대폰번호<br>
                - 고유토큰<br>
                - 개별 설문링크
              </div>
            </div>
          </div>

          <div class="step">
            <div class="step-title">3-2. 외부 문자 발송 플랫폼 활용</div>
            <div class="step-content">
              <ul>
                <li>다운로드한 CSV 파일을 문자 발송 플랫폼에 업로드합니다</li>
                <li>각 참여자에게 개별 설문 링크가 포함된 문자를 발송합니다</li>
                <li>문자 내용 예시:</li>
              </ul>
              <div class="code">
                안녕하세요 [참여자명]님,<br>
                [병원명] 만족도 조사에 참여해 주세요.<br>
                링크: https://사이트주소/[토큰]<br>
                감사합니다.
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 4. 결과 조회 및 통계 분석</div>
          
          <div class="step">
            <div class="step-title">4-1. 설문 결과 조회</div>
            <div class="step-content">
              <ul>
                <li><span class="highlight">'설문 결과'</span> 탭에서 완료된 응답을 확인할 수 있습니다</li>
                <li>참여자별 상세 응답과 총점을 볼 수 있습니다</li>
                <li>CSV 다운로드로 결과 데이터를 추출할 수 있습니다</li>
              </ul>
            </div>
          </div>

          <div class="step">
            <div class="step-title">4-2. 통계 분석</div>
            <div class="step-content">
              <ul>
                <li><span class="highlight">'통계'</span> 탭에서 다양한 분석 결과를 확인할 수 있습니다</li>
                <li>전체 평균점수, 참여율, 병원별 통계를 제공합니다</li>
                <li>병원명을 입력하여 특정 병원의 문항별 평균점수를 조회할 수 있습니다</li>
                <li><span class="highlight">'통계 다운로드'</span> 버튼으로 상세한 엑셀 보고서를 다운로드할 수 있습니다</li>
              </ul>
              <div class="info">
                💡 <strong>통계 보고서 내용:</strong> 기본 통계, 문항별 평균점수, 병원별 통계, 병원별 문항별 상세 분석이 포함됩니다.
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🔒 5. 보안 및 주의사항</div>
          
          <div class="step">
            <div class="step-title">5-1. 보안 기능</div>
            <div class="step-content">
              <ul>
                <li>관리자 페이지 접속 시 비밀번호 인증이 필요합니다</li>
                <li>설문지 삭제 시 추가 비밀번호 확인이 있습니다</li>
                <li>각 참여자에게는 고유한 토큰이 부여되어 보안이 강화됩니다</li>
                <li>중복 응답은 자동으로 방지됩니다</li>
              </ul>
            </div>
          </div>

          <div class="step">
            <div class="step-title">5-2. 설문 링크 형식</div>
            <div class="step-content">
              <div class="code">
                설문 링크 형식: https://사이트주소/[고유토큰]<br>
                예시: https://bohunsurvey.netlify.app/ABC123DEF456
              </div>
              <div class="warning">
                ⚠️ <strong>주의:</strong> 토큰은 각 참여자마다 고유하므로 다른 사람과 공유하면 안 됩니다.
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🔧 6. 시스템 정보</div>
          
          <div class="step">
            <div class="step-content">
              <ul>
                <li><strong>관리자 비밀번호:</strong> <span class="highlight">hospital2024</span></li>
                <li><strong>지원 브라우저:</strong> Chrome, Firefox, Safari, Edge 최신 버전</li>
                <li><strong>권장 해상도:</strong> 1280x720 이상</li>
                <li><strong>CSV 파일 인코딩:</strong> UTF-8</li>
              </ul>
              <div class="info">
                📞 <strong>문의사항:</strong> 시스템 사용 중 문제가 발생하면 시스템 관리자에게 연락하시기 바랍니다.
              </div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 50px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
          <p><strong>🏥 병원 만족도 조사 시스템 v1.0</strong></p>
          <p>© 2024 Hospital Survey System. All rights reserved.</p>
        </div>
      </body>
      </html>
    `

    // HTML을 PDF로 변환
    import("html2canvas")
      .then((html2canvas) => {
        import("jspdf").then(({ jsPDF }) => {
          // 임시 div 생성
          const tempDiv = document.createElement("div")
          tempDiv.innerHTML = guideHTML
          tempDiv.style.width = "800px"
          tempDiv.style.position = "absolute"
          tempDiv.style.left = "-9999px"
          document.body.appendChild(tempDiv)

          html2canvas
            .default(tempDiv, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              width: 800,
              height: tempDiv.scrollHeight,
            })
            .then((canvas) => {
              const imgData = canvas.toDataURL("image/png")
              const pdf = new jsPDF("p", "mm", "a4")

              const imgWidth = 190
              const pageHeight = 297
              const imgHeight = (canvas.height * imgWidth) / canvas.width
              let heightLeft = imgHeight
              let position = 10

              // 첫 페이지 추가
              pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight)
              heightLeft -= pageHeight

              // 필요한 경우 추가 페이지 생성
              while (heightLeft >= 0) {
                position = heightLeft - imgHeight + 10
                pdf.addPage()
                pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight)
                heightLeft -= pageHeight
              }

              // PDF 다운로드
              const fileName = `관리자페이지_사용가이드_${new Date().toISOString().split("T")[0]}.pdf`
              pdf.save(fileName)

              // 임시 div 제거
              document.body.removeChild(tempDiv)
            })
            .catch((error) => {
              console.error("PDF 생성 중 오류:", error)
              document.body.removeChild(tempDiv)

              // 실패 시 텍스트 파일로 대체
              const textContent = guideHTML
                .replace(/<[^>]*>/g, "")
                .replace(/\s+/g, " ")
                .trim()
              const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" })
              const link = document.createElement("a")
              const url = URL.createObjectURL(blob)
              link.setAttribute("href", url)
              link.setAttribute("download", `관리자페이지_사용가이드_${new Date().toISOString().split("T")[0]}.txt`)
              link.style.visibility = "hidden"
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            })
        })
      })
      .catch((error) => {
        console.error("라이브러리 로드 실패:", error)
        alert("PDF 생성에 실패했습니다. 브라우저를 새로고침 후 다시 시도해주세요.")
      })
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("비밀번호가 올바르지 않습니다.")
    }
  }

  const fetchSurveys = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/surveys")
      const data = await response.json()

      if (response.ok) {
        setSurveys(data.surveys || [])
      } else {
        setError(data.error || "설문지 조회 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchParticipants = async (surveyId?: number) => {
    if (!supabase) return

    setLoading(true)
    try {
      let query = supabase.from("survey_participants").select("*").order("created_at", { ascending: false })

      if (surveyId) {
        query = query.eq("survey_id", surveyId)
      }

      const { data, error } = await query

      if (error) throw error
      setParticipants(data || [])
    } catch (err) {
      setError("참여자 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchResponses = async (surveyId?: number) => {
    if (!supabase) return

    setLoading(true)
    try {
      let query = supabase
        .from("survey_response_summaries")
        .select(`
          *,
          survey_participants (
            hospital_name,
            participant_name,
            phone_number
          )
        `)
        .order("created_at", { ascending: false })

      if (surveyId) {
        query = query.eq("survey_id", surveyId)
      }

      const { data, error } = await query

      if (error) throw error
      setResponses(data || [])

      if (surveyId) {
        await fetchQuestionStats(surveyId)
      }
    } catch (err) {
      setError("설문 응답 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionStats = async (surveyId: number, hospitalName?: string) => {
    if (!supabase) return

    try {
      const { data: questionsData, error: questionsError } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("question_number", { ascending: true })

      if (questionsError || !questionsData) return

      let responsesQuery = supabase
        .from("survey_responses")
        .select(`
          question_id,
          response_value,
          participant_token,
          survey_questions (
            question_text,
            question_number
          ),
          survey_participants!inner (
            hospital_name
          )
        `)
        .in(
          "question_id",
          questionsData.map((q) => q.id),
        )

      if (hospitalName && hospitalName.trim() !== "") {
        responsesQuery = responsesQuery.ilike("survey_participants.hospital_name", `%${hospitalName.trim()}%`)
      }

      const { data: responsesData, error: responsesError } = await responsesQuery

      if (responsesError || !responsesData) return

      const questionStatsMap = questionsData.map((question) => {
        const questionResponses = responsesData.filter((r: any) => r.question_id === question.id)
        const totalResponses = questionResponses.length
        const averageScore =
          totalResponses > 0 ? questionResponses.reduce((sum, r: any) => sum + r.response_value, 0) / totalResponses : 0

        return {
          id: question.id,
          questionNumber: question.question_number,
          questionText: question.question_text,
          totalResponses,
          averageScore: averageScore.toFixed(1),
          maxScore: 5,
        }
      })

      setQuestionStats(questionStatsMap)
    } catch (err) {
      console.error("문항별 통계 조회 오류:", err)
    }
  }

  const handleCreateSurvey = async () => {
    if (!newSurveyTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = newSurveyQuestions.filter((q) => q.question.trim() !== "")
    if (validQuestions.length === 0) {
      setError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setCreateLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newSurveyTitle.trim(),
          description: newSurveyDescription.trim(),
          questions: validQuestions.map((q) => ({
            question: q.question.trim(),
            answers: q.answers.filter((a) => a.trim() !== ""),
          })),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 생성되었습니다.")
        setNewSurveyTitle("")
        setNewSurveyDescription("")
        setNewSurveyQuestions([
          { question: "", answers: ["매우 그렇다", "그렇다", "보통이다", "그렇지 않다", "전혀 그렇지 않다"] },
        ])
        fetchSurveys()
      } else {
        setError(data.error || "설문지 생성 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 생성 중 오류가 발생했습니다.")
    } finally {
      setCreateLoading(false)
    }
  }

  const addQuestion = () => {
    setNewSurveyQuestions([
      ...newSurveyQuestions,
      { question: "", answers: ["매우 그렇다", "그렇다", "보통이다", "그렇지 않다", "전혀 그렇지 않다"] },
    ])
  }

  const removeQuestionOld = (index: number) => {
    if (newSurveyQuestions.length > 1) {
      setNewSurveyQuestions(newSurveyQuestions.filter((_, i) => i !== index))
    }
  }

  const updateQuestionOld = (index: number, field: "question" | "answers", value: string | string[]) => {
    const updated = [...newSurveyQuestions]
    if (field === "question") {
      updated[index].question = value as string
    } else {
      updated[index].answers = value as string[]
    }
    setNewSurveyQuestions(updated)
  }

  const addAnswerOld = (questionIndex: number) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers.push("")
    setNewSurveyQuestions(updated)
  }

  const removeAnswerOld = (questionIndex: number, answerIndex: number) => {
    const updated = [...newSurveyQuestions]
    if (updated[questionIndex].answers.length > 1) {
      updated[questionIndex].answers = updated[questionIndex].answers.filter((_, i) => i !== answerIndex)
      setNewSurveyQuestions(updated)
    }
  }

  const updateAnswerOld = (questionIndex: number, answerIndex: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers[answerIndex] = value
    setNewSurveyQuestions(updated)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/csv") {
      setSelectedFile(file)
      setError("")
    } else {
      setError("CSV 파일만 업로드 가능합니다.")
      setSelectedFile(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("파일을 선택해주세요.")
      return
    }

    if (!selectedSurvey) {
      setError("설문지를 선택해주세요.")
      return
    }

    setLoading(true)
    setError("")
    setUploadSuccess("")

    try {
      const formData = new FormData()
      formData.append("csvFile", selectedFile)

      const response = await fetch(`/api/admin/surveys/${selectedSurvey.id}/participants`, {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadSuccess(result.message)
        setSelectedFile(null)
        const fileInput = document.getElementById("csvFile") as HTMLInputElement
        if (fileInput) fileInput.value = ""
        fetchParticipants(selectedSurvey.id)
      } else {
        setError(result.error || "업로드 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("업로드 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (token: string) => {
    const surveyUrl = `${window.location.origin}/${token}`
    try {
      await navigator.clipboard.writeText(surveyUrl)
      alert("설문 링크가 클립보드에 복사되었습니다!")
    } catch (err) {
      alert("링크 복사에 실패했습니다.")
    }
  }

  const downloadCSV = () => {
    if (responses.length === 0) {
      alert("다운로드할 데이터가 없습니다.")
      return
    }

    const headers = ["병원명", "참여자명", "휴대폰번호", "총점", "최대점수", "완료일시"]

    const csvData = responses.map((response) => [
      response.survey_participants?.hospital_name || "",
      response.survey_participants?.participant_name || "",
      response.survey_participants?.phone_number || "",
      response.total_score || "",
      response.max_possible_score || "",
      new Date(response.created_at).toLocaleString("ko-KR"),
    ])

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `설문조사_결과_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openDetailModal = (response: SurveyResponse) => {
    setSelectedResponse(response)
    setShowDetailModal(true)
  }

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey)
    setEditTitle(survey.title)
    setEditDescription(survey.description || "")
    setEditQuestions(survey.survey_questions?.map((q) => q.question_text) || [""])
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = editQuestions.filter((q) => q.trim() !== "")
    if (validQuestions.length === 0) {
      setError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setEditLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/surveys/${editingSurvey?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          questions: validQuestions,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 수정되었습니다.")
        setShowEditModal(false)
        setEditingSurvey(null)
        fetchSurveys()
        if (selectedSurvey?.id === editingSurvey?.id) {
          setSelectedSurvey(null)
        }
      } else {
        setError(data.error || "설문지 수정 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 수정 중 오류가 발생했습니다.")
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteConfirm = (survey: Survey) => {
    setSurveyToDelete(survey)
    setShowDeleteConfirm(true)
  }

  const handleDeleteSurvey = async () => {
    if (!surveyToDelete) return

    if (deletePassword !== ADMIN_PASSWORD) {
      setError("비밀번호가 올바르지 않습니다.")
      return
    }

    setDeleteLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/surveys/${surveyToDelete.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 삭제되었습니다.")
        setShowDeleteConfirm(false)
        setSurveyToDelete(null)
        setDeletePassword("")
        fetchSurveys()
        if (selectedSurvey?.id === surveyToDelete.id) {
          setSelectedSurvey(null)
        }
      } else {
        setError(data.error || "설문지 삭제 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 삭제 중 오류가 발생했습니다.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const addEditQuestion = () => {
    setEditQuestions([...editQuestions, ""])
  }

  const removeEditQuestion = (index: number) => {
    if (editQuestions.length > 1) {
      setEditQuestions(editQuestions.filter((_, i) => i !== index))
    }
  }

  const updateEditQuestion = (index: number, value: string) => {
    const updated = [...editQuestions]
    updated[index] = value
    setEditQuestions(updated)
  }

  const filterParticipants = useCallback(() => {
    let filtered = participants

    if (hospitalFilter.trim()) {
      filtered = filtered.filter((p) => p.hospital_name.toLowerCase().includes(hospitalFilter.toLowerCase()))
    }

    if (statusFilter !== "all") {
      const isCompleted = statusFilter === "completed"
      filtered = filtered.filter((p) => p.is_completed === isCompleted)
    }

    setFilteredParticipants(filtered)
  }, [participants, hospitalFilter, statusFilter])

  const downloadStatsExcel = async () => {
    if (!selectedSurvey || responses.length === 0) {
      alert("다운로드할 통계 데이터가 없습니다.")
      return
    }

    const hospitalQuestionStats: Record<string, Record<number, any>> = {}

    try {
      if (supabase) {
        const { data: detailedResponses, error } = await supabase
          .from("survey_responses")
          .select(`
            question_id,
            response_value,
            survey_questions (
              question_text,
              question_number
            ),
            survey_participants!inner (
              hospital_name
            )
          `)
          .in(
            "question_id",
            questionStats.map((q) => q.id),
          )

        if (!error && detailedResponses) {
          detailedResponses.forEach((response: any) => {
            const hospital = response.survey_participants?.hospital_name || "알 수 없음"
            const questionId = response.question_id
            const questionNumber = response.survey_questions?.question_number || 0
            const questionText = response.survey_questions?.question_text || ""

            if (!hospitalQuestionStats[hospital]) {
              hospitalQuestionStats[hospital] = {}
            }

            if (!hospitalQuestionStats[hospital][questionId]) {
              hospitalQuestionStats[hospital][questionId] = {
                questionNumber,
                questionText,
                responses: [],
                total: 0,
                count: 0,
              }
            }

            hospitalQuestionStats[hospital][questionId].responses.push(response.response_value)
            hospitalQuestionStats[hospital][questionId].total += response.response_value
            hospitalQuestionStats[hospital][questionId].count += 1
          })
        }
      }
    } catch (err) {
      console.error("병원별 문항별 통계 조회 오류:", err)
    }

    const basicStats = [
      ["통계 항목", "값"],
      ["설문지 제목", selectedSurvey.title],
      ["총 참여자 수", participants.length.toString()],
      ["완료된 설문 수", responses.length.toString()],
      ["완료율", `${participants.length > 0 ? Math.round((responses.length / participants.length) * 100) : 0}%`],
      [
        "전체 평균 점수",
        responses.length > 0
          ? `${(responses.reduce((sum, r) => sum + (r.total_score || 0), 0) / responses.length).toFixed(1)}/${responses.length > 0 ? responses[0].max_possible_score : 0}`
          : "0",
      ],
      [""],
    ]

    const questionStatsData = [
      ["문항별 통계"],
      ["문항 번호", "문항 내용", "응답 수", "평균 점수"],
      ...questionStats.map((stat) => [
        stat.questionNumber.toString(),
        stat.questionText,
        stat.totalResponses.toString(),
        `${stat.averageScore}/${stat.maxScore}`,
      ]),
      [""],
    ]

    const hospitalStats = responses.reduce((acc: Record<string, any>, response) => {
      const hospital = response.survey_participants?.hospital_name || "알 수 없음"
      if (!acc[hospital]) {
        acc[hospital] = { count: 0, totalScore: 0, maxScore: response.max_possible_score }
      }
      acc[hospital].count += 1
      acc[hospital].totalScore += response.total_score || 0
      return acc
    }, {})

    const hospitalStatsData = [
      ["병원별 통계"],
      ["병원명", "응답 수", "평균 점수"],
      ...Object.entries(hospitalStats).map(([hospital, stats]: [string, any]) => [
        hospital,
        stats.count.toString(),
        `${(stats.totalScore / stats.count).toFixed(1)}/${stats.maxScore}`,
      ]),
      [""],
    ]

    const hospitalQuestionStatsData = [
      ["병원별 문항별 상세 통계"],
      ["병원명", "문항 번호", "문항 내용", "응답 수", "평균 점수"],
    ]

    Object.keys(hospitalQuestionStats)
      .sort()
      .forEach((hospital) => {
        const hospitalData = hospitalQuestionStats[hospital]

        const sortedQuestions = Object.values(hospitalData).sort(
          (a: any, b: any) => a.questionNumber - b.questionNumber,
        )

        sortedQuestions.forEach((questionData: any) => {
          const average = questionData.count > 0 ? (questionData.total / questionData.count).toFixed(1) : "0"
          hospitalQuestionStatsData.push([
            hospital,
            questionData.questionNumber.toString(),
            questionData.questionText,
            questionData.count.toString(),
            `${average}/5`,
          ])
        })

        const hospitalTotalStats = hospitalStats[hospital]
        if (hospitalTotalStats) {
          hospitalQuestionStatsData.push([
            hospital,
            "전체",
            "모든 문항 평균",
            hospitalTotalStats.count.toString(),
            `${(hospitalTotalStats.totalScore / hospitalTotalStats.count).toFixed(1)}/${hospitalTotalStats.maxScore}`,
          ])
        }

        hospitalQuestionStatsData.push(["", "", "", "", ""])
      })

    const allData = [...basicStats, ...questionStatsData, ...hospitalStatsData, ...hospitalQuestionStatsData]

    const csvContent = allData.map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${selectedSurvey.title}_통계_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchSurveys()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (selectedSurvey) {
      fetchParticipants(selectedSurvey.id)
      fetchResponses(selectedSurvey.id)
    }
  }, [selectedSurvey])

  useEffect(() => {
    if (selectedSurvey) {
      fetchQuestionStats(selectedSurvey.id, hospitalFilter)
    }
  }, [selectedSurvey, hospitalFilter])

  useEffect(() => {
    filterParticipants()
  }, [filterParticipants])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">관리자 로그인</CardTitle>
            <CardDescription>병원 만족도 조사 관리 시스템</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-lg font-medium">
                  비밀번호
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-12 text-lg"
                  placeholder="관리자 비밀번호를 입력하세요"
                  required
                />
              </div>
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700">
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      {!isAuthenticated ? (
        <></>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리 시스템</h1>
            <Button onClick={() => setIsAuthenticated(false)} variant="outline" className="text-lg px-6 py-2">
              로그아웃
            </Button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리자</h1>
            <Button onClick={downloadGuide} variant="outline" className="flex items-center space-x-2 bg-transparent">
              <FileText className="w-4 h-4" />
              <span>사용 가이드 다운로드</span>
            </Button>
          </div>

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertDescription className="text-red-700 text-lg">{error}</AlertDescription>
            </Alert>
          )}

          {uploadSuccess && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <AlertDescription className="text-green-700 text-lg">{uploadSuccess}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="surveys" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 h-12">
              <TabsTrigger value="surveys" className="text-lg">
                설문지 관리
              </TabsTrigger>
              <TabsTrigger value="upload" className="text-lg">
                참여자 등록
              </TabsTrigger>
              <TabsTrigger value="participants" className="text-lg">
                참여자 목록
              </TabsTrigger>
              <TabsTrigger value="responses" className="text-lg">
                설문 결과
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-lg">
                통계
              </TabsTrigger>
            </TabsList>

            <TabsContent value="surveys">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">새 설문지 생성</CardTitle>
                    <CardDescription className="text-lg">
                      설문지 제목과 문항들을 입력하여 새로운 설문지를 만드세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label htmlFor="surveyTitle" className="text-lg font-medium">
                        설문지 제목 *
                      </Label>
                      <Input
                        id="surveyTitle"
                        value={newSurveyTitle}
                        onChange={(e) => setNewSurveyTitle(e.target.value)}
                        className="mt-2 h-12 text-lg"
                        placeholder="예: 2024년 병원 만족도 조사"
                      />
                    </div>

                    <div>
                      <Label htmlFor="surveyDescription" className="text-lg font-medium">
                        설문지 설명
                      </Label>
                      <Textarea
                        id="surveyDescription"
                        value={newSurveyDescription}
                        onChange={(e) => setNewSurveyDescription(e.target.value)}
                        className="mt-2 text-lg"
                        placeholder="설문지에 대한 간단한 설명을 입력하세요"
                        rows={3}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-lg font-medium">설문 문항 *</Label>
                        <Button onClick={addQuestion} size="sm" variant="outline">
                          <Plus className="w-4 h-4 mr-1" />
                          문항 추가
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {newSurveyQuestions.map((question, index) => (
                          <div key={index} className="space-y-3 p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`question-${index}`} className="text-sm font-medium">
                                문항 {index + 1}
                              </Label>
                              {newSurveyQuestions.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeQuestion(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  삭제
                                </Button>
                              )}
                            </div>
                            <Textarea
                              id={`question-${index}`}
                              placeholder="질문을 입력하세요"
                              value={question.question}
                              onChange={(e) => updateQuestion(index, e.target.value)}
                              className="min-h-[80px]"
                            />

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">답변 옵션</Label>
                              {question.answers.map((answer, answerIndex) => (
                                <div key={answerIndex} className="flex items-center gap-2">
                                  <Input
                                    placeholder={`답변 옵션 ${answerIndex + 1}`}
                                    value={answer}
                                    onChange={(e) => updateAnswer(index, answerIndex, e.target.value)}
                                    className="flex-1"
                                  />
                                  {question.answers.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeAnswer(index, answerIndex)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      삭제
                                    </Button>
                                  )}
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addAnswer(index)}
                                className="w-full"
                              >
                                답변 옵션 추가
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleCreateSurvey}
                      disabled={createLoading}
                      className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700"
                    >
                      {createLoading ? "생성 중..." : "설문지 생성"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">설문지 목록</CardTitle>
                    <CardDescription className="text-lg">생성된 설문지를 확인하고 관리하세요</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-center py-8">
                        <p className="text-xl">데이터를 불러오는 중...</p>
                      </div>
                    ) : surveys.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xl text-gray-500">생성된 설문지가 없습니다</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {surveys.map((survey) => (
                          <div
                            key={survey.id}
                            className={`p-4 border rounded-lg transition-colors ${
                              selectedSurvey?.id === survey.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 cursor-pointer" onClick={() => setSelectedSurvey(survey)}>
                                <h3 className="text-lg font-semibold">{survey.title}</h3>
                                {survey.description && <p className="text-gray-600 mt-1">{survey.description}</p>}
                                <p className="text-sm text-gray-500 mt-2">
                                  문항 수: {survey.survey_questions?.length || 0}개 | 생성일:{" "}
                                  {new Date(survey.created_at).toLocaleDateString("ko-KR")}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    survey.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {survey.is_active ? "활성" : "비활성"}
                                </span>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditSurvey(survey)
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  수정
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteConfirm(survey)
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  삭제
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="upload">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">참여자 CSV 업로드</CardTitle>
                  <CardDescription className="text-lg">
                    선택한 설문지에 참여자를 등록합니다. 병원명|대상자이름|휴대폰번호 형식의 CSV 파일을 업로드하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-lg font-medium">설문지 선택 *</Label>
                    <div className="mt-2 p-4 border rounded-lg">
                      {selectedSurvey ? (
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-semibold">{selectedSurvey.title}</h3>
                            <p className="text-gray-600">{selectedSurvey.description}</p>
                          </div>
                          <Button onClick={() => setSelectedSurvey(null)} variant="outline" size="sm">
                            변경
                          </Button>
                        </div>
                      ) : (
                        <p className="text-gray-500">위의 설문지 관리 탭에서 설문지를 선택해주세요</p>
                      )}
                    </div>
                  </div>

                  {selectedSurvey && (
                    <>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="csvFile" className="text-lg font-medium">
                            CSV 파일 선택
                          </Label>
                          <Input
                            id="csvFile"
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="mt-2 h-12 text-lg"
                          />
                        </div>

                        {selectedFile && (
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-lg font-medium text-blue-800">선택된 파일:</p>
                            <p className="text-lg text-blue-600">{selectedFile.name}</p>
                            <p className="text-sm text-blue-500">크기: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                          </div>
                        )}

                        <Button
                          onClick={handleUpload}
                          disabled={!selectedFile || loading}
                          className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {loading ? "업로드 중..." : "CSV 파일 업로드"}
                        </Button>
                      </div>

                      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                        <h3 className="text-xl font-semibold mb-4">CSV 파일 형식 안내</h3>
                        <div className="space-y-3">
                          <p className="text-lg">
                            <strong>형식:</strong> 병원명|대상자이름|휴대폰번호
                          </p>
                          <p className="text-lg">
                            <strong>예시:</strong>
                          </p>
                          <div className="bg-white p-4 rounded border font-mono text-sm">
                            서울대학교병원|김철수|010-1234-5678
                            <br />
                            연세대학교병원|이영희|010-9876-5432
                            <br />
                            고려대학교병원|박민수|010-5555-6666
                          </div>
                          <p className="text-lg text-red-600">
                            <strong>주의:</strong> 기존 참여자는 초기화되고 새로운 참여자로 교체됩니다.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="participants">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">참여자 목록</CardTitle>
                  <CardDescription className="text-lg">
                    등록된 참여자들의 정보와 설문 진행 상황을 확인하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedSurvey ? (
                    <div className="text-center py-8">
                      <p className="text-xl text-gray-500">설문지를 선택해주세요</p>
                    </div>
                  ) : loading ? (
                    <div className="text-center py-8">
                      <p className="text-xl">데이터를 불러오는 중...</p>
                    </div>
                  ) : participants.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xl text-gray-500">등록된 참여자가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">병원명 검색</label>
                          <input
                            type="text"
                            placeholder="병원명을 입력하세요"
                            value={hospitalFilter}
                            onChange={(e) => setHospitalFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">완료 상태</label>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="all">전체</option>
                            <option value="completed">완료</option>
                            <option value="incomplete">미완료</option>
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button
                            onClick={downloadParticipantsExcel}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white"
                            disabled={filteredParticipants.length === 0}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            연락처 다운로드
                          </Button>
                          <Button
                            onClick={() => {
                              setHospitalFilter("")
                              setStatusFilter("all")
                            }}
                            variant="outline"
                            className="px-4 py-2"
                          >
                            필터 초기화
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        총 {participants.length}명 중 {filteredParticipants.length}명 표시
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                병원명
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                참여자명
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                휴대폰번호
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">상태</th>
                              <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                등록일
                              </th>
                              <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                설문 링크
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredParticipants.map((participant) => (
                              <tr key={participant.id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-3 text-lg">
                                  {participant.hospital_name}
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-lg">
                                  {participant.participant_name}
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-lg">{participant.phone_number}</td>
                                <td className="border border-gray-300 px-4 py-3">
                                  <span
                                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                      participant.is_completed
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}
                                  >
                                    {participant.is_completed ? "완료" : "미완료"}
                                  </span>
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-lg">
                                  {new Date(participant.created_at).toLocaleDateString("ko-KR")}
                                </td>
                                <td className="border border-gray-300 px-4 py-3">
                                  <div className="flex space-x-2">
                                    <Button
                                      onClick={() => copyToClipboard(participant.token)}
                                      size="sm"
                                      variant="outline"
                                      className="text-sm"
                                    >
                                      <Copy className="w-4 h-4 mr-1" />
                                      링크 복사
                                    </Button>
                                    <Button
                                      onClick={() => window.open(`/${participant.token}`, "_blank")}
                                      size="sm"
                                      variant="outline"
                                      className="text-sm"
                                    >
                                      <ExternalLink className="w-4 h-4 mr-1" />
                                      열기
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="responses">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl">설문 결과</CardTitle>
                      <CardDescription className="text-lg">완료된 설문 응답을 확인하고 다운로드하세요</CardDescription>
                    </div>
                    {responses.length > 0 && (
                      <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4 mr-2" />
                        CSV 다운로드
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedSurvey ? (
                    <div className="text-center py-8">
                      <p className="text-xl text-gray-500">설문지를 선택해주세요</p>
                    </div>
                  ) : loading ? (
                    <div className="text-center py-8">
                      <p className="text-xl">데이터를 불러오는 중...</p>
                    </div>
                  ) : responses.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xl text-gray-500">완료된 설문이 없습니다</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">병원명</th>
                            <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                              참여자명
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                              휴대폰번호
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">총점</th>
                            <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                              완료일시
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                              상세보기
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {responses.map((response) => (
                            <tr key={response.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-3 text-lg">
                                {response.survey_participants?.hospital_name || ""}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-lg">
                                {response.survey_participants?.participant_name || ""}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-lg">
                                {response.survey_participants?.phone_number || ""}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-lg">
                                {response.total_score || 0} / {response.max_possible_score || 0}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-lg">
                                {new Date(response.created_at).toLocaleString("ko-KR")}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">
                                <Button
                                  onClick={() => openDetailModal(response)}
                                  size="sm"
                                  variant="outline"
                                  className="text-sm"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  상세보기
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-2xl">통계</CardTitle>
                        <CardDescription className="text-lg">설문 결과에 대한 상세 통계를 확인하세요</CardDescription>
                      </div>
                      {selectedSurvey && responses.length > 0 && (
                        <Button onClick={downloadStatsExcel} className="bg-green-600 hover:bg-green-700">
                          <Download className="w-4 h-4 mr-2" />
                          통계 엑셀 다운로드
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!selectedSurvey ? (
                      <div className="text-center py-8">
                        <p className="text-xl text-gray-500">설문지를 선택해주세요</p>
                      </div>
                    ) : responses.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xl text-gray-500">통계를 표시할 데이터가 없습니다</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <div className="bg-blue-50 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-blue-800">총 참여자</h3>
                            <p className="text-3xl font-bold text-blue-600">{participants.length}명</p>
                          </div>
                          <div className="bg-green-50 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-green-800">완료된 설문</h3>
                            <p className="text-3xl font-bold text-green-600">{responses.length}명</p>
                          </div>
                          <div className="bg-yellow-50 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-yellow-800">완료율</h3>
                            <p className="text-3xl font-bold text-yellow-600">
                              {participants.length > 0 ? Math.round((responses.length / participants.length) * 100) : 0}
                              %
                            </p>
                          </div>
                          <div className="bg-purple-50 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-purple-800">평균 점수</h3>
                            <p className="text-3xl font-bold text-purple-600">
                              {responses.length > 0
                                ? (
                                    responses.reduce((sum, r) => sum + (r.total_score || 0), 0) / responses.length
                                  ).toFixed(1)
                                : "0"}
                              /{responses.length > 0 ? responses[0].max_possible_score : 0}
                            </p>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">문항별 평균점수</h3>
                            <div className="flex items-center space-x-2">
                              <Label htmlFor="hospitalFilter" className="text-sm">
                                병원 필터:
                              </Label>
                              <Input
                                id="hospitalFilter"
                                value={hospitalFilter}
                                onChange={(e) => setHospitalFilter(e.target.value)}
                                placeholder="병원명 입력"
                                className="w-48"
                              />
                            </div>
                          </div>
                          {questionStats.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse border border-gray-300">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                      문항 번호
                                    </th>
                                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                      문항 내용
                                    </th>
                                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                      응답 수
                                    </th>
                                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                      평균 점수
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {questionStats.map((stat) => (
                                    <tr key={stat.id} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 px-4 py-3">{stat.questionNumber}</td>
                                      <td className="border border-gray-300 px-4 py-3">{stat.questionText}</td>
                                      <td className="border border-gray-300 px-4 py-3">{stat.totalResponses}</td>
                                      <td className="border border-gray-300 px-4 py-3">
                                        {stat.averageScore}/{stat.maxScore}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-gray-500">문항별 통계 데이터가 없습니다.</p>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xl font-semibold mb-4">병원별 통계</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">병원명</th>
                                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">응답 수</th>
                                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                    평균 점수
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(
                                  responses.reduce((acc: Record<string, any>, response) => {
                                    const hospital = response.survey_participants?.hospital_name || "알 수 없음"
                                    if (!acc[hospital]) {
                                      acc[hospital] = { count: 0, totalScore: 0, maxScore: response.max_possible_score }
                                    }
                                    acc[hospital].count += 1
                                    acc[hospital].totalScore += response.total_score || 0
                                    return acc
                                  }, {}),
                                ).map(([hospital, stats]: [string, any]) => (
                                  <tr key={hospital} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-4 py-3">{hospital}</td>
                                    <td className="border border-gray-300 px-4 py-3">{stats.count}</td>
                                    <td className="border border-gray-300 px-4 py-3">
                                      {(stats.totalScore / stats.count).toFixed(1)}/{stats.maxScore}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">새 설문지 생성</CardTitle>
                  <CardDescription>설문지 제목, 설명, 문항과 답변 옵션을 입력하세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">설문지 제목 *</Label>
                      <Input
                        id="title"
                        value={newSurveyTitle}
                        onChange={(e) => setNewSurveyTitle(e.target.value)}
                        placeholder="예: 2024년 병원 만족도 조사"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">설문지 설명</Label>
                      <Textarea
                        id="description"
                        value={newSurveyDescription}
                        onChange={(e) => setNewSurveyDescription(e.target.value)}
                        placeholder="설문지에 대한 간단한 설명을 입력하세요"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">설문 문항 및 답변 옵션</Label>
                      <Button onClick={addQuestion} size="sm" className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        문항 추가
                      </Button>
                    </div>

                    {newSurveyQuestions.map((questionData, questionIndex) => (
                      <Card key={questionIndex} className="p-4 border-l-4 border-blue-500">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="font-medium">문항 {questionIndex + 1}</Label>
                            {newSurveyQuestions.length > 1 && (
                              <Button
                                onClick={() => removeQuestion(questionIndex)}
                                size="sm"
                                variant="destructive"
                                className="flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                삭제
                              </Button>
                            )}
                          </div>

                          <div>
                            <Label htmlFor={`question-${questionIndex}`}>질문 내용 *</Label>
                            <Textarea
                              id={`question-${questionIndex}`}
                              value={questionData.question}
                              onChange={(e) => updateQuestion(questionIndex, "question", e.target.value)}
                              placeholder="예: 의료진의 친절도에 만족하십니까?"
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">답변 옵션</Label>
                              <Button
                                onClick={() => addAnswer(questionIndex)}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                답변 추가
                              </Button>
                            </div>

                            {questionData.answers.map((answer, answerIndex) => (
                              <div key={answerIndex} className="flex items-center gap-2">
                                <span className="text-sm font-medium w-8">{answerIndex + 1}.</span>
                                <Input
                                  value={answer}
                                  onChange={(e) => updateAnswer(questionIndex, answerIndex, e.target.value)}
                                  placeholder={`답변 옵션 ${answerIndex + 1}`}
                                  className="flex-1"
                                />
                                {questionData.answers.length > 1 && (
                                  <Button
                                    onClick={() => removeAnswer(questionIndex, answerIndex)}
                                    size="sm"
                                    variant="ghost"
                                    className="p-1 h-8 w-8"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {error && (
                    <Alert>
                      <AlertDescription className="text-red-600">{error}</AlertDescription>
                    </Alert>
                  )}

                  {uploadSuccess && (
                    <Alert>
                      <AlertDescription className="text-green-600">{uploadSuccess}</AlertDescription>
                    </Alert>
                  )}

                  <Button onClick={handleCreateSurvey} disabled={createLoading} className="w-full" size="lg">
                    {createLoading ? "생성 중..." : "설문지 생성"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )

  const updateQuestion = (index: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[index].question = value
    setNewSurveyQuestions(updated)
  }

  const updateAnswer = (questionIndex: number, answerIndex: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers[answerIndex] = value
    setNewSurveyQuestions(updated)
  }

  const addAnswer = (questionIndex: number) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers.push("")
    setNewSurveyQuestions(updated)
  }

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    const updated = [...newSurveyQuestions]
    if (updated[questionIndex].answers.length > 2) {
      updated[questionIndex].answers.splice(answerIndex, 1)
      setNewSurveyQuestions(updated)
    }
  }

  const removeQuestion = (index: number) => {
    if (newSurveyQuestions.length > 1) {
      const updated = newSurveyQuestions.filter((_, i) => i !== index)
      setNewSurveyQuestions(updated)
    }
  }
}
