import 'package:flutter/material.dart';
import "package:firebase_core/firebase_core.dart";
import './functions.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,

  );
  runApp(const MaterialApp(home: MyHomePage()));
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});
  @override
  createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("gwon") , centerTitle: true,),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Center(

          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              sectionTitle("인적사항"),
              Text1("이름 : 이성권"),
              Text1("번호 : 01066249602"),
              Text1("email : gwondev0323@gmail.com"),
              Text1("github : https://github.com/gwondev"),

              sectionTitle("학력"),
              entry("2008/03/04 ~ 2014/02/19", "연제초등학교 졸업"),
              entry("2008/03/03 ~ 2017/02/10", "양산중학교 졸업"),
              entry("2017/03/02 ~ 2020/01/10", "전자공업고등학교 졸업"),

              sectionTitle("프로젝트"),
              Text1("gwon.my [APP] : 자기소개앱, Flutter를 사용한 앱 프로그래밍, Fire Base를 사용한 웹 호스팅"),
              Text1("devsign.co.kr [WEB] : 동아리웹사이트, Spring Boot를 사용한 웹 프로그래밍"),
              Text1("devsign online judge [AWS] : 동아리웹사이트, Spring Boot를 사용한 웹 프로그래밍"),
              Text1("MOVE [IOT][WEB] : 팀빌딩6기, 실시간이동관리시스템, Spring Boot를 사용한 웹 프로그래밍, Gps모듈을 사용한 IOT시스템"),


              sectionTitle("자격증"),
              entry("2017/12/27", "정보처리기능사 - 한국산업인력공단"),
              entry("2019/06/20", "정보기기운용기능사 - 한국산업인력공단"),
              entry("2019/03/15", "컴퓨터활용능력1급 - 대한상공회의소"),

              sectionTitle("경력"),
              entry("2022/01 ~ 2023/01", "아파트 독서실 - 청소 및 회원 응대"),
              entry("2023/07 ~ 2023/09", "농산업인증원 - 문서화, 사무보조"),
              entry("2024/01 ~ 2024/10", "CU편의점 - 물류정리 및 응대"),
              entry("2025/01 ~ 2025/02", "삼성전자모바일사업부 - 맨테크윈에서 운전 출장 업무"),

              SizedBox(height: 30),

            ],
          ),
        )

      ),
    );
  }
}
Widget sectionTitle(String title) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 12),
  child: Text(title, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
);

Widget entry(String date, String desc) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 4),
  child: Text("• $date  $desc", style: TextStyle(fontSize: 16)),
);