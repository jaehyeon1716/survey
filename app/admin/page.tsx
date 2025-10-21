"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

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
    question_type: string
    response_scale_type?: string // 문항별 응답 척도 타입 추가
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

interface DetailedQuestionResponse {
  question_number: number
  question_text: string
  question_type: string
  response_value: number | null
  response_text: string | null
}

interface QuestionStat {
  id: number
  questionNumber: number
  questionText: string
  questionType: string
  responseScaleType: string // responseScaleType 필드 추가
  totalResponses: number
  averageScore: string
  maxScore: number
  textResponses?: string[] // For subjective questions
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([]) // Changed from Response[] to SurveyResponse[]
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [newSurvey, setNewSurvey] = useState({ title: "", description: "" }) // Simplified new survey state
  const [questions, setQuestions] = useState<Array<{ text: string; type: string; responseScaleType: string }>>([
    { text: "", type: "objective", responseScaleType: "agreement" }, // scaleType 추가
  ])
  const [file, setFile] = useState<File | null>(null) // Renamed from selectedFile
  const [surveyError, setSurveyError] = useState("")
  const [surveySuccess, setSurveySuccess] = useState("")
  const [participantError, setParticipantError] = useState("")
  const [participantSuccess, setParticipantSuccess] = useState("")
  const [duplicates, setDuplicates] = useState<Array<{ hospital: string; name: string; phone: string }>>([]) // Renamed from duplicateParticipants
  const [isUploading, setIsUploading] = useState(false) // Renamed from loading for upload context
  const [uploadProgress, setUploadProgress] = useState(0) // Simplified upload progress
  const [isDownloading, setIsDownloading] = useState(false)
  const [totalParticipantsCount, setTotalParticipantsCount] = useState(0)
  const [filteredParticipantsCount, setFilteredParticipantsCount] = useState(0)
  const [totalResponsesCount, setTotalResponsesCount] = useState(0)
  const [participantsPage, setParticipantsPage] = useState(1)
  const [participantsPerPage, setParticipantsPerPage] = useState(10)
  const [responsesPage, setResponsesPage] = useState(1)
  const [responsesPerPage, setResponsesPerPage] = useState(10)
  const [hospitalFilter, setHospitalFilter] = useState("")
  const [hospitalSearchInput, setHospitalSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "incomplete">("all")
  const [statsHospitalFilter, setStatsHospitalFilter] = useState("")
  const [statsHospitalSearchInput, setStatsHospitalSearchInput] = useState("")
  const [subjectiveResponsesPage, setSubjectiveResponsesPage] = useState<Record<number, number>>({})
  const [subjectiveResponsesPerPage, setSubjectiveResponsesPerPage] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false) // Added loading state
  const [createLoading, setCreateLoading] = useState(false) // Added createLoading state

  // States for editing existing survey
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editQuestions, setEditQuestions] = useState<Array<{ text: string; type: string; scaleType: string }>>([])
  const [editLoading, setEditLoading] = useState(false)

  // States for deleting survey
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")

  // States for detailed response modal
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailedResponses, setDetailedResponses] = useState<DetailedQuestionResponse[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const handleHospitalSearch = () => {
    setHospitalFilter(hospitalSearchInput)
    setParticipantsPage(1)
  }

  const handleResetHospitalFilter = () => {
    setHospitalSearchInput("")
    setHospitalFilter("")
    setParticipantsPage(1)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleHospitalSearch()
    }
  }

  const downloadParticipantsExcel = async () => {
    if (!selectedSurvey) {
      alert("설문지를 선택해주세요.")
      return
    }

    if (totalParticipantsCount === 0) {
      alert("다운로드할 참여자 데이터가 없습니다.")
      return
    }

    setIsDownloading(true)

    try {
      // Fetch all participants in batches
      const allParticipants: any[] = []
      const batchSize = 1000
      let offset = 0

      while (offset < totalParticipantsCount) {
        const { data, error } = await supabase
          .from("survey_participants")
          .select("*")
          .eq("survey_id", selectedSurvey.id)
          .range(offset, offset + batchSize - 1)
          .order("created_at", { ascending: true })

        if (error) {
          console.error("[v0] Error fetching participants for download:", error)
          throw error
        }

        if (data) {
          allParticipants.push(...data)
        }

        offset += batchSize
      }

      console.log(`[v0] Downloaded ${allParticipants.length} participants for Excel`)

      const excelData = allParticipants.map((participant) => ({
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
      link.setAttribute(
        "download",
        `${selectedSurvey.title}_참여자연락처_${new Date().toISOString().split("T")[0]}.csv`,
      )
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("[v0] Error downloading participants:", error)
      alert("연락처 다운로드 중 오류가 발생했습니다.")
    } finally {
      setIsDownloading(false)
    }
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
                <li>문항 유형을 선택하세요 (객관식 - 5점 척도 / 주관식 - 텍스트)</li>
                <li><span class="highlight">각 문항별 응답 척도 유형을 선택하세요.</span></li>
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
      // Removed setError("") here, as login error is handled separately
    } else {
      // Moved error handling to the login form component
      // setError("비밀번호가 올바르지 않습니다.")
    }
  }

  const fetchSurveys = async () => {
    setLoading(true) // Assuming a general loading state, though specific ones are preferred
    setSurveyError("") // Clear previous error
    setSurveySuccess("") // Clear previous success
    try {
      const response = await fetch("/api/admin/surveys")
      const data = await response.json()

      if (response.ok) {
        setSurveys(data.surveys || [])
      } else {
        setSurveyError(data.error || "설문지 조회 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setSurveyError("설문지 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchParticipants = async (surveyId?: number, page = 1, perPage = 10) => {
    if (!supabase) return

    setLoading(true)
    setParticipantError("") // Clear previous error
    setParticipantSuccess("") // Clear previous success
    try {
      let unfilteredCountQuery = supabase.from("survey_participants").select("*", { count: "exact", head: true })
      if (surveyId) {
        unfilteredCountQuery = unfilteredCountQuery.eq("survey_id", surveyId)
      }
      const { count: unfilteredCount, error: unfilteredCountError } = await unfilteredCountQuery
      if (unfilteredCountError) throw unfilteredCountError
      setTotalParticipantsCount(unfilteredCount || 0)

      let countQuery = supabase.from("survey_participants").select("*", { count: "exact", head: true })

      if (surveyId) {
        countQuery = countQuery.eq("survey_id", surveyId)
      }

      // Apply filters to count query
      if (hospitalFilter.trim()) {
        countQuery = countQuery.ilike("hospital_name", `%${hospitalFilter}%`)
      }
      if (statusFilter !== "all") {
        countQuery = countQuery.eq("is_completed", statusFilter === "completed")
      }

      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setFilteredParticipantsCount(count || 0)

      // Fetch only the current page of data
      const start = (page - 1) * perPage
      const end = start + perPage - 1

      let query = supabase
        .from("survey_participants")
        .select("*")
        .order("created_at", { ascending: false })
        .range(start, end)

      if (surveyId) {
        query = query.eq("survey_id", surveyId)
      }

      // Apply filters to data query
      if (hospitalFilter.trim()) {
        query = query.ilike("hospital_name", `%${hospitalFilter}%`)
      }
      if (statusFilter !== "all") {
        query = query.eq("is_completed", statusFilter === "completed")
      }

      const { data, error } = await query

      if (error) throw error
      setParticipants(data || [])
      // setParticipants(data || []) // This line seems to be duplicated, might be a typo. Keep one.
      // setFilteredParticipants(data || []) // This line was removed and replaced by direct use of `participants` later. If `filteredParticipants` is needed for other logic, reintroduce it.
    } catch (err) {
      setParticipantError("참여자 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchResponses = async (surveyId?: number, hospitalName?: string) => {
    if (!supabase) return

    setLoading(true)
    // No specific error/success state for this fetch, it's part of the overall loading
    try {
      let countQuery = supabase.from("survey_response_summaries").select("*", { count: "exact", head: true })

      if (surveyId) {
        countQuery = countQuery.eq("survey_id", surveyId)
      }

      if (hospitalName && hospitalName.trim()) {
        // Need to join with survey_participants to filter by hospital
        const { data: participantTokens } = await supabase
          .from("survey_participants")
          .select("token")
          .eq("survey_id", surveyId || 0)
          .ilike("hospital_name", `%${hospitalName.trim()}%`)

        if (participantTokens && participantTokens.length > 0) {
          const tokens = participantTokens.map((p) => p.token)
          countQuery = countQuery.in("participant_token", tokens)
        } else {
          // No participants match the filter, set count to 0
          setTotalResponsesCount(0)
          setResponses([])
          setLoading(false)
          return
        }
      }

      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setTotalResponsesCount(count || 0)

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
        .range(0, 9999) // Increased range for better initial fetch, pagination will handle smaller chunks

      if (surveyId) {
        query = query.eq("survey_id", surveyId)
      }

      if (hospitalName && hospitalName.trim()) {
        const { data: participantTokens } = await supabase
          .from("survey_participants")
          .select("token")
          .eq("survey_id", surveyId || 0)
          .ilike("hospital_name", `%${hospitalName.trim()}%`)

        if (participantTokens && participantTokens.length > 0) {
          const tokens = participantTokens.map((p) => p.token)
          query = query.in("participant_token", tokens)
        }
      }

      const { data, error } = await query

      if (error) throw error
      setResponses(data || [])

      if (surveyId) {
        await fetchQuestionStats(surveyId)
      }
    } catch (err) {
      console.error("Error fetching responses:", err)
    } finally {
      setLoading(false)
    }
  }

  // This is the modified fetchQuestionStats function
  const fetchQuestionStats = async (surveyId: number) => {
    if (!supabase) return

    try {
      console.log("[v0] Fetching question stats for survey:", surveyId)

      const { data: questionsData, error: questionsError } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("question_number", { ascending: true })

      console.log("[v0] Questions data:", questionsData)
      if (questionsError) {
        console.error("[v0] Questions error:", questionsError)
        return
      }
      if (!questionsData) return

      const { data: responsesData, error: responsesError } = await supabase
        .from("survey_responses")
        .select("question_id, response_value, response_text, participant_token")
        .in(
          "question_id",
          questionsData.map((q) => q.id),
        )
        .limit(1000000)

      console.log("[v0] Responses data:", responsesData)
      if (responsesError) {
        console.error("[v0] Responses error:", responsesError)
        return
      }
      if (!responsesData) return

      console.log("[v0] Total responses:", responsesData.length)

      const questionStatsMap = questionsData.map((question) => {
        const questionResponses = responsesData.filter((r) => r.question_id === question.id)

        // For objective questions, calculate average score
        const objectiveResponses = questionResponses.filter((r) => r.response_value !== null)
        const averageScore =
          objectiveResponses.length > 0
            ? objectiveResponses.reduce((sum, r) => sum + r.response_value, 0) / objectiveResponses.length
            : 0

        // For subjective questions, collect text responses
        const textResponses = questionResponses
          .filter((r) => r.response_text !== null && r.response_text.trim() !== "")
          .map((r) => r.response_text)

        const totalResponses = question.question_type === "subjective" ? textResponses.length : questionResponses.length

        return {
          id: question.id,
          questionNumber: question.question_number,
          questionText: question.question_text,
          questionType: question.question_type || "objective",
          responseScaleType: question.response_scale_type || "agreement",
          totalResponses,
          averageScore: averageScore.toFixed(1),
          maxScore: 5,
          textResponses,
        }
      })

      console.log("[v0] Question stats map:", questionStatsMap)
      setQuestionStats(questionStatsMap)
    } catch (err) {
      console.error("[v0] Error in fetchQuestionStats:", err)
      setSurveyError("문항별 통계 조회 중 오류가 발생했습니다.")
    }
  }

  const handleCreateSurvey = async () => {
    if (!newSurvey.title.trim()) {
      setSurveyError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = questions.filter((q) => q.text.trim() !== "")
    if (validQuestions.length === 0) {
      setSurveyError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setCreateLoading(true) // Renamed from isUploading to createLoading
    setSurveyError("")
    setSurveySuccess("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newSurvey.title.trim(),
          description: newSurvey.description.trim(),
          questions: validQuestions.map((q) => ({
            text: q.text,
            type: q.type,
            responseScaleType: q.responseScaleType,
          })), // use responseScaleType
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Update the error message based on the response from the API
        setSurveyError(data.error || "설문지 생성 중 오류가 발생했습니다.")
        return
      }

      // Clear form and show success message
      setSurveySuccess("설문지가 성공적으로 생성되었습니다.")
      setNewSurvey({ title: "", description: "" }) // Reset newSurvey state
      setQuestions([{ text: "", type: "objective", responseScaleType: "agreement" }]) // Reset questions state
      fetchSurveys()
    } catch (err) {
      setSurveyError("설문지 생성 중 오류가 발생했습니다.")
    } finally {
      setCreateLoading(false) // Renamed from isUploading to createLoading
    }
  }

  const addQuestion = () => {
    setQuestions([...questions, { text: "", type: "objective", responseScaleType: "agreement" }]) // use responseScaleType
  }

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, field: "text" | "type" | "responseScaleType", value: string) => {
    // Added responseScaleType
    // scaleType 필드 추가
    const updated = [...questions]
    updated[index][field] = value
    setQuestions(updated)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/csv") {
      setFile(file) // Use setFile
      setParticipantError("") // Clear previous error
      setParticipantSuccess("") // Clear previous success
    } else {
      setParticipantError("CSV 파일만 업로드 가능합니다.")
      setFile(null) // Use setFile
      setParticipantSuccess("") // Clear previous success
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setParticipantError("파일을 선택해주세요.")
      return
    }

    if (!selectedSurvey) {
      setParticipantError("설문지를 선택해주세요.")
      return
    }

    setIsUploading(true) // Use isUploading
    setParticipantError("")
    setParticipantSuccess("")
    setUploadProgress(0)
    setDuplicates([])

    try {
      // Read and parse CSV on client side
      const csvText = await file.text()
      const lines = csvText.trim().split("\n")

      if (lines.length === 0) {
        setParticipantError("CSV 파일이 비어있습니다.")
        setIsUploading(false)
        return
      }

      // Parse all participants
      const participants: Array<{
        hospital_name: string
        participant_name: string
        phone_number: string
      }> = []
      const uniqueParticipants = new Set()
      const duplicateEntries: Array<{
        hospital: string
        name: string
        phone: string
      }> = [] // Use duplicateEntries

      for (const line of lines) {
        const [hospitalName, participantName, phoneNumber] = line.split("|").map((item) => item.trim())

        if (!hospitalName || !participantName || !phoneNumber) {
          continue
        }

        const participantKey = `${hospitalName}|${participantName}|${phoneNumber}`
        if (uniqueParticipants.has(participantKey)) {
          duplicateEntries.push({
            // Use duplicateEntries
            hospital: hospitalName,
            name: participantName,
            phone: phoneNumber,
          })
          continue
        }
        uniqueParticipants.add(participantKey)

        participants.push({
          hospital_name: hospitalName,
          participant_name: participantName,
          phone_number: phoneNumber,
        })
      }

      if (participants.length === 0) {
        setParticipantError("유효한 참여자 데이터가 없습니다.")
        setIsUploading(false)
        return
      }

      // Split into chunks of 500 participants
      const CHUNK_SIZE = 500
      const chunks: (typeof participants)[] = []
      for (let i = 0; i < participants.length; i += CHUNK_SIZE) {
        chunks.push(participants.slice(i, i + CHUNK_SIZE))
      }

      console.log(`[v0] 총 ${participants.length}명을 ${chunks.length}개 청크로 나누어 업로드 시작`)

      // Upload each chunk
      let totalUploaded = 0
      for (let i = 0; i < chunks.length; i++) {
        const progress = Math.round(((i + 1) / chunks.length) * 100)
        setUploadProgress(progress) // Use setUploadProgress

        const response = await fetch(`/api/admin/surveys/${selectedSurvey.id}/participants`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participants: chunks[i],
            isFirstBatch: i === 0,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || `청크 ${i + 1}/${chunks.length} 업로드 실패`)
        }

        totalUploaded += chunks[i].length
        console.log(`[v0] 청크 ${i + 1}/${chunks.length} 완료: ${totalUploaded}/${participants.length}명 등록됨`)
      }

      let successMessage = `${totalUploaded}명의 참여자가 성공적으로 등록되었습니다.`
      if (duplicateEntries.length > 0) {
        // Use duplicateEntries
        successMessage += ` (중복 ${duplicateEntries.length}건 제외)`
        setDuplicates(duplicateEntries) // Use setDuplicates
      }

      setParticipantSuccess(successMessage)
      setFile(null) // Use setFile
      const fileInput = document.getElementById("csvFile") as HTMLInputElement
      if (fileInput) fileInput.value = ""
      fetchParticipants(selectedSurvey.id)
    } catch (err) {
      setParticipantError(err instanceof Error ? err.message : "업로드 중 오류가 발생했습니다.")
      console.error("[v0] Upload error:", err)
    } finally {
      setIsUploading(false) // Use isUploading
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

  const openDetailModal = async (response: SurveyResponse) => {
    setSelectedResponse(response)
    setShowDetailModal(true)
    setLoadingDetails(true)

    try {
      if (!supabase) return

      // Fetch detailed responses with question information
      const { data, error } = await supabase
        .from("survey_responses")
        .select(`
          response_value,
          response_text,
          survey_questions (
            question_number,
            question_text,
            question_type
          )
        `)
        .eq("participant_token", response.participant_token)
        .order("survey_questions(question_number)", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching detailed responses:", error)
        return
      }

      // Transform the data
      const details: DetailedQuestionResponse[] = (data || []).map((item: any) => ({
        question_number: item.survey_questions?.question_number || 0,
        question_text: item.survey_questions?.question_text || "",
        question_type: item.survey_questions?.question_type || "objective",
        response_value: item.response_value,
        response_text: item.response_text,
      }))

      // Sort by question number
      details.sort((a, b) => a.question_number - b.question_number)

      setDetailedResponses(details)
    } catch (err) {
      console.error("[v0] Error loading detailed responses:", err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey)
    setEditTitle(survey.title)
    setEditDescription(survey.description || "")
    setEditQuestions(
      survey.survey_questions?.map((q) => ({
        text: q.question_text,
        type: q.question_type || "objective",
        scaleType: q.response_scale_type || "agreement", // scaleType 설정
      })) || [{ text: "", type: "objective", scaleType: "agreement" }], // scaleType 초기화
    )
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setSurveyError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = editQuestions.filter((q) => q.text.trim() !== "")
    if (validQuestions.length === 0) {
      setSurveyError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setEditLoading(true)
    setSurveyError("")
    setSurveySuccess("")

    try {
      const response = await fetch(`/api/admin/surveys/${editingSurvey?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          // Pass questions with text, type, and responseScaleType
          questions: validQuestions.map((q) => ({ text: q.text, type: q.type, responseScaleType: q.scaleType })), // responseScaleType 추가
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSurveyError(data.error || "설문지 수정 중 오류가 발생했습니다.")
        return
      }

      setSurveySuccess("설문지가 성공적으로 수정되었습니다.")
      setShowEditModal(false)
      setEditingSurvey(null)
      fetchSurveys()
      if (selectedSurvey?.id === editingSurvey?.id) {
        // If the edited survey was the selected one, clear selection to refetch data
        setSelectedSurvey(null)
      }
    } catch (err) {
      setSurveyError("설문지 수정 중 오류가 발생했습니다.")
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteConfirm = (survey: Survey) => {
    setSurveyToDelete(survey)
    setShowDeleteConfirm(true)
  }

  const deleteSurvey = async (surveyId: number) => {
    if (!surveyToDelete) return

    if (deletePassword !== ADMIN_PASSWORD) {
      setSurveyError("비밀번호가 올바르지 않습니다.")
      return
    }

    setDeleteLoading(true)
    setSurveyError("")
    setSurveySuccess("")

    try {
      const response = await fetch(`/api/admin/surveys/${surveyId}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(900000), // 15 minutes for large datasets
      })

      const data = await response.json()

      if (!response.ok) {
        setSurveyError(data.error || "설문지 삭제 중 오류가 발생했습니다.")
      } else {
        setSurveySuccess(data.message || "설문지가 성공적으로 삭제되었습니다.")
        setShowDeleteConfirm(false)
        setSurveyToDelete(null)
        setDeletePassword("")
        fetchSurveys()
        if (selectedSurvey?.id === surveyId) {
          setSelectedSurvey(null)
        }
      }
    } catch (err) {
      console.error("[v0] 설문지 삭제 오류:", err)
      setSurveyError("설문지 삭제 중 오류가 발생했습니다. 대용량 데이터의 경우 시간이 오래 걸릴 수 있습니다.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const addEditQuestion = () => {
    setEditQuestions([...editQuestions, { text: "", type: "objective", scaleType: "agreement" }]) // scaleType 추가
  }

  const removeEditQuestion = (index: number) => {
    if (editQuestions.length > 1) {
      setEditQuestions(editQuestions.filter((_, i) => i !== index))
    }
  }

  const updateEditQuestion = (index: number, field: "text" | "type" | "scaleType", value: string) => {
    // scaleType 필드 추가
    const updated = [...editQuestions]
    updated[index][field] = value
    setEditQuestions(updated)
  }

  // const filterParticipants = useCallback(() => { ... }, [...])

  const downloadStatsExcel = async () => {
    if (!selectedSurvey || responses.length === 0) {
      alert("다운로드할 통계 데이터가 없습니다.")
      return
    }

    const hospitalQuestionStats: Record<string, Record<number, any>> = {}
    const allSubjectiveResponses: Array<{ questionNumber: number; hospitalName: string; responseText: string }> = []

    try {
      if (supabase) {
        const { data: allQuestions, error: questionsError } = await supabase
          .from("survey_questions")
          .select("*")
          .eq("survey_id", selectedSurvey.id)
          .order("question_number", { ascending: true })

        console.log("[v0] All questions for Excel:", allQuestions)

        if (questionsError || !allQuestions) {
          console.error("[v0] Error fetching questions:", questionsError)
          alert("문항 정보를 가져오는 중 오류가 발생했습니다.")
          return
        }

        const { data: detailedResponses, error } = await supabase
          .from("survey_responses")
          .select(`
            question_id,
            response_value,
            response_text,
            participant_token
          `)
          .in(
            "question_id",
            allQuestions.map((q) => q.id),
          )

        console.log("[v0] Detailed responses query result:", { detailedResponses, error })

        if (error) {
          console.error("[v0] Error fetching detailed responses:", error)
        }

        if (!error && detailedResponses) {
          const tokens = [...new Set(detailedResponses.map((r: any) => r.participant_token))]
          const { data: participantsData, error: participantsError } = await supabase
            .from("survey_participants")
            .select("token, hospital_name")
            .in("token", tokens)

          console.log("[v0] Participants data:", { participantsData, participantsError })

          const tokenToHospital: Record<string, string> = {}
          if (participantsData) {
            participantsData.forEach((p: any) => {
              tokenToHospital[p.token] = p.hospital_name
            })
          }

          const questionMap = new Map(allQuestions.map((q) => [q.id, q]))

          detailedResponses.forEach((response: any) => {
            const hospital = tokenToHospital[response.participant_token] || "알 수 없음"
            const questionId = response.question_id
            const question = questionMap.get(questionId)

            if (!question) return

            const questionNumber = question.question_number
            const questionText = question.question_text
            const questionType = question.question_type || "objective"
            const responseScaleType = question.response_scale_type || "agreement"

            if (!hospitalQuestionStats[hospital]) {
              hospitalQuestionStats[hospital] = {}
            }

            if (!hospitalQuestionStats[hospital][questionId]) {
              hospitalQuestionStats[hospital][questionId] = {
                questionNumber,
                questionText,
                questionType,
                responseScaleType,
                responses: [],
                textResponses: [],
                total: 0,
                count: 0,
              }
            }

            if (questionType === "objective") {
              if (response.response_value !== null) {
                hospitalQuestionStats[hospital][questionId].responses.push(response.response_value)
                hospitalQuestionStats[hospital][questionId].total += response.response_value
                hospitalQuestionStats[hospital][questionId].count += 1
              }
            } else {
              if (response.response_text !== null && response.response_text.trim() !== "") {
                hospitalQuestionStats[hospital][questionId].textResponses.push(response.response_text)
                hospitalQuestionStats[hospital][questionId].count += 1

                allSubjectiveResponses.push({
                  questionNumber,
                  hospitalName: hospital,
                  responseText: response.response_text,
                })
              }
            }
          })
        }
      }
    } catch (err) {
      console.error("[v0] 병원별 문항별 통계 조회 오류:", err)
    }

    console.log("[v0] Hospital question stats:", hospitalQuestionStats)

    const basicStats = [
      ["통계 항목", "값"],
      ["설문지 제목", selectedSurvey.title],
      ["총 참여자 수", totalParticipantsCount.toLocaleString()],
      ["완료된 설문 수", totalResponsesCount.toLocaleString()],
      [
        "완료율",
        `${totalParticipantsCount > 0 ? ((totalResponsesCount / totalParticipantsCount) * 100).toFixed(1) : "0.0"}%`,
      ],
      [
        "전체 평균 점수",
        responses.length > 0
          ? `${(responses.reduce((sum, r) => sum + (r.total_score || 0), 0) / responses.length).toFixed(
              2,
            )}/${responses.length > 0 ? responses[0].max_possible_score : 0}`
          : "0.00",
      ],
      [""],
    ]

    const objectiveQuestionStatsData = [
      ["객관식 문항별 통계"],
      ["문항 번호", "문항 내용", "응답 수", "평균 점수"],
      ...questionStats
        .filter((stat) => stat.questionType === "objective")
        .map((stat) => [
          stat.questionNumber.toString(),
          stat.questionText,
          stat.totalResponses.toString(),
          `${stat.averageScore}/${stat.maxScore}`,
        ]),
      [""],
    ]

    const subjectiveQuestionStatsData = [
      ["주관식 문항별 통계"],
      ["문항 번호", "문항 내용", "응답 수"],
      ...questionStats
        .filter((stat) => stat.questionType === "subjective")
        .map((stat) => [stat.questionNumber.toString(), stat.questionText, stat.totalResponses.toString()]),
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
      ["병원명", "문항 번호", "문항 내용", "문항 유형", "응답 척도", "응답 수", "평균 점수", "응답 내용 (주관식)"], // 응답 척도 열 추가
    ]

    Object.keys(hospitalQuestionStats)
      .sort()
      .forEach((hospital) => {
        const hospitalData = hospitalQuestionStats[hospital]

        const sortedQuestions = Object.values(hospitalData).sort(
          (a: any, b: any) => a.questionNumber - b.questionNumber,
        )

        sortedQuestions.forEach((questionData: any) => {
          if (questionData.questionType === "objective") {
            const average = questionData.count > 0 ? (questionData.total / questionData.count).toFixed(1) : "0"
            hospitalQuestionStatsData.push([
              hospital,
              questionData.questionNumber.toString(),
              questionData.questionText,
              "객관식",
              questionData.responseScaleType === "agreement" ? "동의 척도" : "만족도 척도", // 척도 이름 표시
              questionData.count.toString(),
              `${average}/5`,
              "", // No subjective responses for objective questions
            ])
          } else {
            // subjective
            hospitalQuestionStatsData.push([
              hospital,
              questionData.questionNumber.toString(),
              questionData.questionText,
              "주관식",
              "", // No response scale for subjective questions
              questionData.count.toString(),
              "", // No average score for subjective questions
              questionData.textResponses ? questionData.textResponses.join("; ") : "", // Join multiple responses
            ])
          }
        })

        const hospitalTotalStats = hospitalStats[hospital]
        if (hospitalTotalStats) {
          hospitalQuestionStatsData.push([
            hospital,
            "전체",
            "모든 문항 평균",
            "",
            "",
            hospitalTotalStats.count.toString(),
            `${(hospitalTotalStats.totalScore / hospitalTotalStats.count).toFixed(1)}/${hospitalTotalStats.maxScore}`,
            "",
          ])
        }

        hospitalQuestionStatsData.push(["", "", "", "", "", "", "", ""]) // 열 개수 조정
      })

    const subjectiveResponsesData = [
      ["주관식 응답내용"],
      ["문항번호", "병원명", "응답내용"],
      ...allSubjectiveResponses
        .sort((a, b) => a.questionNumber - b.questionNumber)
        .map((response) => [response.questionNumber.toString(), response.hospitalName, response.responseText]),
      [""],
    ]

    const allData = [
      ...basicStats,
      ...objectiveQuestionStatsData,
      ...subjectiveQuestionStatsData,
      ...hospitalStatsData,
      ...hospitalQuestionStatsData,
      ...subjectiveResponsesData, // Added new subjective responses section
    ]

    console.log("[v0] Excel data rows:", allData.length)

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

  const handleRefresh = async () => {
    if (!selectedSurvey) {
      await fetchSurveys()
      return
    }

    setLoading(true)
    try {
      await Promise.all([
        fetchSurveys(),
        fetchParticipants(selectedSurvey.id, participantsPage, participantsPerPage),
        fetchResponses(selectedSurvey.id, hospitalFilter),
        fetchQuestionStats(selectedSurvey.id),
      ])
    } catch (err) {
      // Consider adding a general error state for refresh if needed
      console.error("Refresh error:", err)
      alert("데이터 새로고침 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchSurveys()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (selectedSurvey) {
      fetchParticipants(selectedSurvey.id, participantsPage, participantsPerPage)
      fetchResponses(selectedSurvey.id, hospitalFilter)
    }
  }, [selectedSurvey, participantsPage, participantsPerPage, hospitalFilter, statusFilter])

  useEffect(() => {
    if (selectedSurvey) {
      fetchQuestionStats(selectedSurvey.id)
    }
  }, [selectedSurvey])

  useEffect(() => {
    // This effect is now tied to the fetchParticipants call, which is in the main useEffect.
    // We need to ensure pages reset correctly when filters change.
    setParticipantsPage(1)
  }, [hospitalFilter, statusFilter, filteredParticipantsCount]) // Depend on filteredParticipantsCount to re-evaluate pages

  useEffect(() => {
    setResponsesPage(1)
  }, [responses.length])

  // Initialize subjective response pagination states based on fetched question stats
  useEffect(() => {
    const initialSubjectivePages: Record<number, number> = {}
    const initialSubjectivePerPage: Record<number, number> = {}
    questionStats
      .filter((stat) => stat.questionType === "subjective")
      .forEach((stat) => {
        initialSubjectivePages[stat.id] = 1
        initialSubjectivePerPage[stat.id] = 10
      })
    setSubjectiveResponsesPage(initialSubjectivePages)
    setSubjectiveResponsesPerPage(initialSubjectivePerPage)
  }, [questionStats]) // Re-run when questionStats change

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">관리자 로그인</CardTitle>
            <CardDescription>병원 만족도 조사 관리 시스템</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleLogin(e)
              }}
              className="space-y-4"
            >
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
              {/* Replaced generic error state with specific login error handling */}
              {password !== ADMIN_PASSWORD && password !== "" && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">비밀번호가 올바르지 않습니다.</AlertDescription>
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

  // const paginatedParticipants = filteredParticipants // Removed filteredParticipants usage, directly using participants
  const totalParticipantsPages = Math.ceil(totalParticipantsCount / participantsPerPage)

  const paginatedResponses = responses.slice((responsesPage - 1) * responsesPerPage, responsesPage * responsesPerPage)
  const totalResponsesPages = Math.ceil(responses.length / responsesPerPage)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리 시스템</h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="flex items-center gap-2 bg-transparent"
              disabled={loading} // Use loading state
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {/* Use actual loading state */}
              새로고침
            </Button>
            <Button onClick={() => setIsAuthenticated(false)} variant="outline" className="text-lg px-6 py-2">
              로그아웃
            </Button>
          </div>
        </div>

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
                      value={newSurvey.title}
                      onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })}
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
                      value={newSurvey.description}
                      onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })}
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
                      {questions.map((question, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50">
                          <div className="flex gap-2 items-start">
                            <div className="flex-1">
                              <Label className="text-sm mb-1">문항 {index + 1}</Label>
                              <Input
                                value={question.text}
                                onChange={(e) => updateQuestion(index, "text", e.target.value)}
                                placeholder={`문항 ${index + 1}을 입력하세요`}
                                className="h-12 text-lg"
                              />
                            </div>
                            {questions.length > 1 && (
                              <Button
                                onClick={() => removeQuestion(index)}
                                size="sm"
                                variant="outline"
                                className="mt-6"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">문항 유형:</Label>
                              <Select
                                value={question.type}
                                onValueChange={(value) => updateQuestion(index, "type", value)}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="objective">객관식 (5점 척도)</SelectItem>
                                  <SelectItem value="subjective">주관식 (텍스트)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {question.type === "objective" && (
                              <div className="flex items-center gap-2">
                                <Label className="text-sm">응답 척도:</Label>
                                <Select
                                  value={question.responseScaleType}
                                  onValueChange={(value) => updateQuestion(index, "responseScaleType", value)}
                                >
                                  <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="agreement">동의 척도 (그렇다)</SelectItem>
                                    <SelectItem value="satisfaction">만족도 척도 (만족한다)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateSurvey}
                    disabled={createLoading} // Use createLoading
                    className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700"
                  >
                    {createLoading ? "생성 중..." : "설문지 생성"}
                  </Button>

                  {surveySuccess && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <AlertDescription className="text-green-700 text-lg font-medium">
                        {surveySuccess}
                      </AlertDescription>
                    </Alert>
                  )}

                  {surveyError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <AlertDescription className="text-red-700 text-lg font-medium">{surveyError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">설문지 목록</CardTitle>
                  <CardDescription className="text-lg">생성된 설문지를 확인하고 관리하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? ( // Use loading state
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
              <CardContent>
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

                      {file && ( // Check if file state is not null
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <p className="text-lg font-medium text-blue-800">선택된 파일:</p>
                          <p className="text-lg text-blue-600">{file.name}</p>
                          <p className="text-sm text-blue-500">크기: {(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                      )}

                      <Button
                        onClick={handleUpload}
                        disabled={!file || isUploading} // Use isUploading state
                        className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                      >
                        {isUploading ? "업로드 중..." : "CSV 파일 업로드"}
                      </Button>

                      {uploadProgress > 0 && ( // Show progress bar only if uploadProgress is greater than 0
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>진행률</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-green-600 h-3 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {participantSuccess && (
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <AlertDescription className="text-green-700 text-lg font-medium">
                            {participantSuccess}
                          </AlertDescription>
                        </Alert>
                      )}

                      {duplicates.length > 0 && ( // Use duplicates state
                        <Alert className="border-yellow-200 bg-yellow-50 mt-4">
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                          <AlertDescription>
                            <div className="text-yellow-800">
                              <p className="font-semibold mb-2">중복된 참여자 {duplicates.length}건</p>
                              <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-yellow-100 sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1 text-left">병원명</th>
                                      <th className="px-2 py-1 text-left">참여자명</th>
                                      <th className="px-2 py-1 text-left">휴대폰번호</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {duplicates.map(
                                      (
                                        dup,
                                        index, // Use duplicates map
                                      ) => (
                                        <tr key={index} className="border-t border-yellow-200">
                                          <td className="px-2 py-1">{dup.hospital}</td>
                                          <td className="px-2 py-1">{dup.name}</td>
                                          <td className="px-2 py-1">{dup.phone}</td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {participantError && (
                        <Alert className="border-red-200 bg-red-50">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <AlertDescription className="text-red-700 text-lg font-medium">
                            {participantError}
                          </AlertDescription>
                        </Alert>
                      )}
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
                ) : loading ? ( // Use loading state
                  <div className="text-center py-8">
                    <p className="text-xl">데이터를 불러오는 중...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">병원명 검색</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="병원명을 입력하세요"
                            value={hospitalSearchInput}
                            onChange={(e) => setHospitalSearchInput(e.target.value)}
                            onKeyPress={handleSearchKeyPress}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <Button
                            onClick={handleHospitalSearch}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            검색
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">완료 상태</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value as "all" | "completed" | "incomplete") // Type assertion
                            setParticipantsPage(1)
                          }}
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
                          disabled={participants.length === 0 || isDownloading} // Check participants length
                        >
                          {isDownloading ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          {isDownloading ? "다운로드 중..." : "연락처 다운로드"}
                        </Button>
                        <Button
                          onClick={() => {
                            setHospitalSearchInput("")
                            setHospitalFilter("")
                            setStatusFilter("all")
                            setParticipantsPage(1)
                          }}
                          variant="outline"
                          className="px-4 py-2"
                        >
                          필터 초기화
                        </Button>
                      </div>
                    </div>

                    {filteredParticipantsCount === 0 ? ( // Use filteredParticipantsCount for check
                      <div className="text-center py-8">
                        <p className="text-xl text-gray-500">등록된 참여자가 없습니다</p>
                      </div>
                    ) : participants.length === 0 ? ( // Check participants length
                      <div className="text-center py-8">
                        <p className="text-xl text-gray-500">검색 결과가 없습니다</p>
                        <p className="text-sm text-gray-400 mt-2">다른 검색어를 입력하거나 필터를 초기화해주세요</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-sm text-gray-600">
                            총 {filteredParticipantsCount.toLocaleString()}명 중{" "}
                            {Math.min(
                              (participantsPage - 1) * participantsPerPage + 1,
                              filteredParticipantsCount,
                            ).toLocaleString()}
                            -
                            {Math.min(
                              participantsPage * participantsPerPage,
                              filteredParticipantsCount,
                            ).toLocaleString()}
                            명 표시
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">페이지당 표시:</span>
                            <select
                              value={participantsPerPage}
                              onChange={(e) => {
                                setParticipantsPerPage(Number(e.target.value))
                                setParticipantsPage(1)
                              }}
                              className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                            >
                              <option value={10}>10개</option>
                              <option value={50}>50개</option>
                              <option value={100}>100개</option>
                            </select>
                          </div>
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
                                <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                  상태
                                </th>
                                <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                  등록일
                                </th>
                                <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                                  설문 링크
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {participants.map((participant) => (
                                <tr key={participant.id} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-3 text-lg">
                                    {participant.hospital_name}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-lg">
                                    {participant.participant_name}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-lg">
                                    {participant.phone_number}
                                  </td>
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
                        {/* pagination */}
                        <div className="flex justify-between items-center mt-4">
                          <div className="text-sm text-gray-600">
                            페이지 {participantsPage} /{" "}
                            {Math.ceil(filteredParticipantsCount / participantsPerPage) || 1}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setParticipantsPage((prev) => Math.max(1, prev - 1))}
                              disabled={participantsPage === 1}
                              variant="outline"
                              size="sm"
                            >
                              이전
                            </Button>
                            <Button
                              onClick={() =>
                                setParticipantsPage((prev) =>
                                  Math.min(Math.ceil(filteredParticipantsCount / participantsPerPage), prev + 1),
                                )
                              }
                              disabled={participantsPage >= Math.ceil(filteredParticipantsCount / participantsPerPage)}
                              variant="outline"
                              size="sm"
                            >
                              다음
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
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
                ) : loading ? ( // Use loading state
                  <div className="text-center py-8">
                    <p className="text-xl">데이터를 불러오는 중...</p>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xl text-gray-500">완료된 설문이 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">페이지당 표시:</label>
                        <select
                          value={responsesPerPage}
                          onChange={(e) => {
                            setResponsesPerPage(Number(e.target.value))
                            setResponsesPage(1)
                          }}
                          className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={10}>10건</option>
                          <option value={100}>100건</option>
                          <option value={1000}>1000건</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setResponsesPage((prev) => Math.max(1, prev - 1))}
                          disabled={responsesPage === 1}
                          variant="outline"
                          size="sm"
                        >
                          이전
                        </Button>
                        <span className="text-sm text-gray-700">
                          {responsesPage} / {totalResponsesPages || 1}
                        </span>
                        <Button
                          onClick={() => setResponsesPage((prev) => Math.min(totalResponsesPages, prev + 1))}
                          disabled={responsesPage >= totalResponsesPages}
                          variant="outline"
                          size="sm"
                        >
                          다음
                        </Button>
                      </div>
                    </div>

                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">병원명</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">참여자명</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                            휴대폰번호
                          </th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">총점</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">완료일시</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">상세보기</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedResponses.map((response) => (
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
                  ) : (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-semibold">병원 필터</h3>
                        <div className="flex items-center space-x-2">
                          <Input
                            value={statsHospitalSearchInput} // Use statsHospitalSearchInput
                            onChange={(e) => setStatsHospitalSearchInput(e.target.value)}
                            onKeyPress={handleSearchKeyPress} // Reusing handleSearchKeyPress
                            placeholder="병원명 입력"
                            className="w-48"
                          />
                          <Button
                            onClick={() => {
                              setStatsHospitalFilter(statsHospitalSearchInput) // Use statsHospitalFilter
                              // Optionally reset page or refetch stats here if needed
                            }}
                            variant="outline"
                          >
                            검색
                          </Button>
                          <Button
                            onClick={() => {
                              setStatsHospitalSearchInput("")
                              setStatsHospitalFilter("")
                              // Optionally reset page or refetch stats here if needed
                            }}
                            variant="outline"
                          >
                            필터 초기화
                          </Button>
                        </div>
                      </div>

                      {responses.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-xl text-gray-500">통계를 표시할 데이터가 없습니다</p>
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <h3 className="text-xl font-semibold mb-2">설문 통계</h3>
                            <div className="grid grid-cols-4 gap-4">
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-muted-foreground">총 참여자</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold">{totalParticipantsCount.toLocaleString()}명</div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-muted-foreground">완료</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-green-600">
                                    {totalResponsesCount.toLocaleString()}명
                                  </div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-muted-foreground">완료율</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-blue-600">
                                    {totalParticipantsCount > 0
                                      ? ((totalResponsesCount / totalParticipantsCount) * 100).toFixed(1)
                                      : "0.0"}
                                    %
                                  </div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-muted-foreground">평균 점수</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-purple-600">
                                    {responses.length > 0
                                      ? (
                                          responses.reduce((sum, r) => sum + (r.total_score || 0), 0) / responses.length
                                        ).toFixed(2)
                                      : "0.00"}
                                    {responses.length > 0 && responses[0]?.max_possible_score
                                      ? ` / ${responses[0].max_possible_score}`
                                      : ""}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-xl font-semibold mb-4">객관식 문항 평균점수</h3>
                            {questionStats.filter((stat) => stat.questionType === "objective").length > 0 ? (
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
                                    {questionStats
                                      .filter((stat) => stat.questionType === "objective")
                                      .map((stat) => (
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
                              <p className="text-gray-500">객관식 문항이 없습니다.</p>
                            )}
                          </div>

                          <div>
                            <h3 className="text-xl font-semibold mb-4">주관식 문항 응답</h3>
                            {questionStats.filter((stat) => stat.questionType === "subjective").length > 0 ? (
                              <div className="space-y-6">
                                {questionStats
                                  .filter((stat) => stat.questionType === "subjective")
                                  .map((stat) => {
                                    const currentPage = subjectiveResponsesPage[stat.id] || 1
                                    const perPage = subjectiveResponsesPerPage[stat.id] || 10
                                    const totalResponses = stat.textResponses?.length || 0
                                    const totalPages = Math.ceil(totalResponses / perPage)
                                    const startIndex = (currentPage - 1) * perPage
                                    const endIndex = startIndex + perPage
                                    const paginatedResponses = stat.textResponses?.slice(startIndex, endIndex) || []

                                    return (
                                      <Card key={stat.id}>
                                        <CardHeader>
                                          <CardTitle className="text-lg">
                                            {stat.questionNumber}. {stat.questionText}
                                          </CardTitle>
                                          <CardDescription>총 {stat.totalResponses}개의 응답</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                          <div className="flex items-center gap-2 mb-4">
                                            <label className="text-sm text-gray-600">페이지당 표시:</label>
                                            <select
                                              value={perPage}
                                              onChange={(e) => {
                                                setSubjectiveResponsesPerPage({
                                                  ...subjectiveResponsesPerPage,
                                                  [stat.id]: Number(e.target.value),
                                                })
                                                setSubjectiveResponsesPage({
                                                  ...subjectiveResponsesPage,
                                                  [stat.id]: 1,
                                                })
                                              }}
                                              className="border rounded px-2 py-1 text-sm"
                                            >
                                              <option value={10}>10건</option>
                                              <option value={50}>50건</option>
                                              <option value={100}>100건</option>
                                            </select>
                                          </div>

                                          {stat.textResponses && stat.textResponses.length > 0 ? (
                                            <>
                                              <div className="space-y-3">
                                                {paginatedResponses.map((response, index) => (
                                                  <div
                                                    key={startIndex + index}
                                                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                                  >
                                                    <p className="text-sm text-gray-700">{response}</p>
                                                  </div>
                                                ))}
                                              </div>

                                              {totalPages > 1 && (
                                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                                  <div className="text-sm text-gray-600">
                                                    {startIndex + 1}-{Math.min(endIndex, totalResponses)} / 총{" "}
                                                    {totalResponses}개
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() =>
                                                        setSubjectiveResponsesPage({
                                                          ...subjectiveResponsesPage,
                                                          [stat.id]: currentPage - 1,
                                                        })
                                                      }
                                                      disabled={currentPage === 1}
                                                    >
                                                      이전
                                                    </Button>
                                                    <span className="text-sm text-gray-600">
                                                      {currentPage} / {totalPages}
                                                    </span>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() =>
                                                        setSubjectiveResponsesPage({
                                                          ...subjectiveResponsesPage,
                                                          [stat.id]: currentPage + 1,
                                                        })
                                                      }
                                                      disabled={currentPage === totalPages}
                                                    >
                                                      다음
                                                    </Button>
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <p className="text-gray-500">응답이 없습니다.</p>
                                          )}
                                        </CardContent>
                                      </Card>
                                    )
                                  })}
                              </div>
                            ) : (
                              <p className="text-gray-500">주관식 문항이 없습니다.</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>설문지 수정</DialogTitle>
              <DialogDescription>설문지 정보를 수정하세요</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editTitle">설문지 제목 *</Label>
                <Input
                  id="editTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="editDescription">설문지 설명</Label>
                <Textarea
                  id="editDescription"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>설문 문항 *</Label>
                  <Button onClick={addEditQuestion} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" />
                    문항 추가
                  </Button>
                </div>
                <div className="space-y-2">
                  {editQuestions.map((question, index) => (
                    <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50">
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Label className="text-sm mb-1">문항 {index + 1}</Label>
                          <Input
                            value={question.text}
                            onChange={(e) => updateEditQuestion(index, "text", e.target.value)}
                            placeholder={`문항 ${index + 1}`}
                          />
                        </div>
                        {editQuestions.length > 1 && (
                          <Button
                            onClick={() => removeEditQuestion(index)}
                            size="sm"
                            variant="outline"
                            className="mt-6"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">문항 유형:</Label>
                          <Select
                            value={question.type}
                            onValueChange={(value) => updateEditQuestion(index, "type", value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="objective">객관식 (5점 척도)</SelectItem>
                              <SelectItem value="subjective">주관식 (텍스트)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {question.type === "objective" && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">응답 척도:</Label>
                            <Select
                              value={question.scaleType}
                              onValueChange={(value) => updateEditQuestion(index, "scaleType", value)}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agreement">동의 척도 (그렇다)</SelectItem>
                                <SelectItem value="satisfaction">만족도 척도 (만족한다)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                취소
              </Button>
              <Button onClick={handleSaveEdit} disabled={editLoading}>
                {editLoading ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>설문지 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                정말로 이 설문지를 삭제하겠습니까? 이 작업은 되돌릴 수 없습니다.
                <br />
                <br />
                삭제하려면 관리자 비밀번호를 입력하세요:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4">
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="관리자 비밀번호"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletePassword("")
                }}
              >
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSurvey(surveyToDelete!.id)} // Use deleteSurvey function with surveyId
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteLoading ? "삭제 중..." : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">설문 응답 상세</DialogTitle>
            </DialogHeader>
            {selectedResponse && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-sm text-gray-600">병원명</Label>
                    <p className="text-lg font-medium">{selectedResponse.survey_participants?.hospital_name || ""}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">참여자명</Label>
                    <p className="text-lg font-medium">
                      {selectedResponse.survey_participants?.participant_name || ""}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">휴대폰번호</Label>
                    <p className="text-lg font-medium">{selectedResponse.survey_participants?.phone_number || ""}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">완료일시</Label>
                    <p className="text-lg font-medium">
                      {new Date(selectedResponse.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <Label className="text-sm text-blue-800">총점</Label>
                  <p className="text-3xl font-bold text-blue-600">
                    {selectedResponse.total_score || 0} / {selectedResponse.max_possible_score || 0}
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-4">문항별 응답</h3>
                  {loadingDetails ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">응답 내역을 불러오는 중...</p>
                    </div>
                  ) : detailedResponses.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">응답 내역이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailedResponses.map((detail, index) => (
                        <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-700">문항 {detail.question_number}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    detail.question_type === "subjective"
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {detail.question_type === "subjective" ? "주관식" : "객관식"}
                                </span>
                              </div>
                              <p className="text-gray-800">{detail.question_text}</p>
                            </div>
                          </div>
                          <div className="mt-3 pl-4 border-l-4 border-gray-200">
                            {detail.question_type === "subjective" ? (
                              <div>
                                <Label className="text-sm text-gray-600">응답 내용:</Label>
                                <p className="mt-1 text-lg text-gray-900 whitespace-pre-wrap">
                                  {detail.response_text || "(응답 없음)"}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <Label className="text-sm text-gray-600">점수:</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-2xl font-bold text-blue-600">{detail.response_value || 0}</span>
                                  <span className="text-gray-500">/ 5점</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowDetailModal(false)} className="px-6">
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
