# Analiza formatu rozkroju KDT / MCUT

## Co zawiera dostarczony plik

`1.2_Pila.mcut` to tekstowy XML w UTF-8. Jego struktura jest zgodna z przykładem `Temp/EditBoard.xml` z pakietu KDT: korzeń `project`, elementy `panelN`, węzły `no.N` oraz listy cięć `part`. Oryginalny plik ze zrzutem pulpitu został zachowany bez zmian. Atrybut `fileName` w kopii z Pulpitu wskazuje ścieżkę z innego komputera, więc importer powinien go traktować jako informację historyczną.

## Rozpoznane pola

- `panelN`: `l`, `w`, `num`, `material`, `thickness`, `saw`, `mcode`; plik `.mcut` ma też `fileName`.
- `no.N`: segment po cięciu, z `l`, `w`, `trim`, `x`, `y`, `layer` i `id`.
- `part`: instrukcja podziału bieżącego segmentu: `cut`, `id`, `type`, `code`.
- `part.id` łączy instrukcję z segmentem `no.N` o takim samym `id`. To pozwala złożyć drzewo cięć, nawet gdy węzły w XML nie występują w kolejności rodzic–dziecko.
- kolejność elementów `part` w danym `no.N` zachowuje kolejność cięć zapisaną dla tego segmentu.
- `x` i `y` opisują położenie segmentu na płycie. Wartości `l` i `w` są obracane między kolejnymi poziomami, więc rysunek powinien wyznaczać rzeczywisty prostokąt z wymiaru cięcia, prostokąta rodzica i położenia dziecka, a nie zakładać stałego kierunku osi.

## Drzewo z przykładu 1.2_Pila

Płyta ma `670 × 2070 mm`, grubość `18 mm`, rzaz `4,4 mm` i jedną sztukę. Drzewo w pliku:

```text
id 1, poziom 1
├─ id 2: cięcie 597 (typ 2)
│  ├─ id 4: cięcie 777 (typ 1) → gotowy element
│  └─ id 5: cięcie 777 (typ 2)
│     ├─ id 6: cięcie 199 (typ 1) → gotowy element
│     └─ id 7: cięcie 195 (typ 1) → gotowy element
└─ id 3: cięcie 50 (typ 2)
   └─ id 8–26: dziewiętnaście cięć po 100 (typ 1)
```

Przykładowe pozycje potwierdzają użycie rzazu do odsunięcia kolejnych elementów: `y=10` dla pierwszego dużego pasa, `y=611,4` dla pasa 50 mm oraz `x=15`, `119,4`, `223,8` dla kolejnych kawałków 100 mm. Wartości `layer` pokazują cztery poziomy podziału. Węzły końcowe opisują 22 prostokątne elementy: 19 elementów 50 × 100 mm oraz elementy 597 × 777, 777 × 199 i 777 × 195 mm.

Zrzut ekranu potwierdza wartości płyty, rzazu i pierwszych cięć: pola „No.1” i „No.2” odpowiadają pierwszym dwóm instrukcjom 597 i 50 mm. Widać też edycję ilości, odpadu/brzegowania, obracanie elementu i przechodzenie do następnego elementu.

Pole „Odpad” 4,2 mm widoczne na ekranie nie występuje jako osobny atrybut w tym pliku. Zapisane są za to `saw=4.4` na poziomie płyty i wartości `trim` poszczególnych segmentów. Nie należy utożsamiać tych trzech wartości bez sprawdzenia zachowania programu.

## Co da się odtworzyć, a co wymaga potwierdzenia

Można odtworzyć czytnik i edytor drzewa `panel` → `no` → `part`, rysunek segmentów w skali, listę etapów, sprawdzanie wymiarów i symulację kolejności zapisanej w XML. Dla każdej instrukcji można zachować identyfikator i `type`, a dzieci powiązać przez `id`.

Dodatkowa analiza dwóch przykładów (1.2_Pila.mcut i Temp/EditBoard.xml) potwierdziła wszystkie 29 powiązań: `type=1` wskazuje węzeł końcowy, `type=2` węzeł z dalszymi instrukcjami. Wszystkie wymiary `part.cut` zgadzają się z lokalnym `w` dziecka. Położenia zgadzają się z brzegowaniem i rzazem z maksymalną różnicą 0,0001 mm. Jest to potwierdzenie zbadanych przykładów, nie specyfikacja wszystkich wersji. Ostatni przejazd wymaga osobnej reguły: w EditBoard.xml po końcowym elemencie zostaje 0,1 mm, więc nie można automatycznie doliczać kolejnego pełnego rzazu. Szczegóły i interaktywny podgląd zawiera MS320-PreSize-analiza.html.

Nie ma w folderze przykładowego pliku `.ptx` ani `.saw`, który potwierdzałby ich format. Zapis zmienionego `.mcut` można dopasować do tego wzorca, lecz zgodność z każdą wersją KDT wymaga sprawdzenia na dodatkowych plikach. Aktualny planer zapisuje pełny projekt we własnym JSON i nie eksportuje zatwierdzonych plików maszynowych.

## Wnioski z pakietu programu

- Nie znaleziono kodu źródłowego aplikacji. Główny plik EXE ma sekcje ochronne `.AKS1`/`.AKS2`, a biblioteki pomocnicze są zarządzanymi bibliotekami .NET.
- `LabelDesign.dll` i dostarczone szablony wskazują osobny moduł etykiet tekstowych i kodów kreskowych/QR.
- `PLCCommunication.dll` i `TcAdsCommunication.dll` są elementami komunikacji ze sterownikami; nie są potrzebne w planowanym, niezależnym symulatorze.
- lokalna baza ustawień ma tabelę `Setting`, ale nie zawiera zleceń rozkroju. Dostępne pliki `Temp` pokazują pomocniczy XML aktualnego rozkroju i historii pracy.
- zewnętrzny opis integracji KDT PreSize potwierdza, że w ustawieniach generatorów stosowane są m.in. kerf, trim, liczba faz, maksymalna szerokość cięcia/stosu i pola etykiet. Nie ujawnia jednak pełnego schematu eksportu KDT.

Źródło ustawień eksportu: [Promob — Cut Pro / WDMAX / KDT PreSize](https://suporte.promob.com/hc/en-us/articles/33023706141073-Cut-Pro-Cutting-Manager-WDMAX-KDT-PreSize).

## Bezpieczny zakres prototypu

Prototyp może działać całkowicie lokalnie: otwierać i zapisywać `.mcut`, pokazywać drzewo i wymiary, zmieniać kolejność/rozmiar zapisanych cięć, sygnalizować elementy poza płytą i animować etapy z pliku. Symulacja opisuje geometrię oraz kolejność danych; nie steruje maszyną i nie poświadcza, że plan jest gotowy do cięcia.

