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
      appBar: AppBar(title: Text("이성권 포트폴리오") , centerTitle: true,),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Center(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              sectionTitle("학력"),
              entry("2008/03/04 ~ 2014/02/19", "연제초등학교 졸업"),
              entry("2008/03/03 ~ 2017/02/10", "양산중학교 졸업"),
              entry("2017/03/02 ~ 2020/01/10", "전자공업고등학교 졸업"),

              sectionTitle("자격증"),
              entry("2017/12/27", "정보처리기능사 - 한국산업인력공단"),
              entry("2019/06/20", "정보기기운용기능사 - 한국산업인력공단"),
              entry("2019/03/15", "컴퓨터활용능력1급 - 대한상공회의소"),

              sectionTitle("경력"),
              entry("2022/01 ~ 2023/01", "아파트 독서실 - 청소 및 회원 응대"),
              entry("2023/07 ~ 2023/09", "농산업인증원 - 문서화, 사무보조"),
              entry("2024/01 ~ 2024/10", "CU편의점 - 물류정리 및 응대"),
              entry("2025/01 ~ 2025/02", "삼성전자 - 모바일사업부 응대"),

              SizedBox(height: 30),
              Center(
                child: Text("이성권의 포트폴리오 사이트",
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
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